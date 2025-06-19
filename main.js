// defaultAccessToken được tạo ra khi đăng kí tài khoản cesium js: https://cesium.com/platform/cesiumjs/
Cesium.Ion.defaultAccessToken = window.CESIUM_TOKEN;
let viewer;
let currentImageEntity = null;

async function initCesium() {
  viewer = new Cesium.Viewer("cesiumContainer", {
    terrain: Cesium.Terrain.fromWorldTerrain({
      requestVertexNormals: true,
    }),
    geocoder: false,
  });

  viewer.scene.globe.enableLighting = true;
  viewer.scene.globe.depthTestAgainstTerrain = true;

  const buildingTileset = await Cesium.createOsmBuildingsAsync();
  viewer.scene.primitives.add(buildingTileset);

  viewer.camera.flyTo({
    destination: Cesium.Rectangle.fromDegrees(
      102.14441,
      8.3817,
      109.4642,
      23.3934
    ),
    duration: 3,
    complete: function () {
      viewer.camera.setView({
        orientation: {
          heading: viewer.camera.heading,
          pitch: Cesium.Math.toRadians(-90),
          roll: 0,
        },
      });
    },
  });
}
// tại 1 la kinh mới
window.addImageOnTerrain = function () {
  if (currentImageEntity) {
    viewer.entities.remove(currentImageEntity);
    currentImageEntity = null;
  }

  const center = new Cesium.Cartesian2(
    viewer.canvas.clientWidth / 2,
    viewer.canvas.clientHeight / 2
  );

  const pickRay = viewer.scene.camera.getPickRay(center);
  const cartesian = viewer.scene.globe.pick(pickRay, viewer.scene);

  if (!cartesian) {
    console.warn("Không xác định được toạ độ tâm.");
    return;
  }

  const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
  const centerLon = Cesium.Math.toDegrees(cartographic.longitude);
  const centerLat = Cesium.Math.toDegrees(cartographic.latitude);

  const cameraHeight = viewer.camera.positionCartographic.height;
  const sizeInMeters = cameraHeight / 2; // đây là chổ điều chỉnh kích thước to, nhỏ cho la kinh(cameraHeight / 4 là nhỏ gấp đôi hiện tại)

  function metersToDegrees(meters, latitude) {
    const latDeg = meters / 111320;
    const lonDeg =
      meters / (111320 * Math.cos(Cesium.Math.toRadians(latitude)));
    return { latDeg, lonDeg };
  }

  const halfSizeMeters = sizeInMeters / 2;
  const { latDeg: halfHeightDegrees, lonDeg: halfWidthDegrees } =
    metersToDegrees(halfSizeMeters, centerLat);

  const rectangle = Cesium.Rectangle.fromDegrees(
    centerLon - halfWidthDegrees,
    centerLat - halfHeightDegrees,
    centerLon + halfWidthDegrees,
    centerLat + halfHeightDegrees
  );

  const hex = document.getElementById("colorPickerInput").value;
  const initialColor = Cesium.Color.fromCssColorString(hex).withAlpha(1.0);

  currentImageEntity = viewer.entities.add({
    rectangle: {
      coordinates: rectangle,
      material: new Cesium.ImageMaterialProperty({
        image: document.getElementById("imageSelect").value,
        transparent: true,
        color: initialColor,
      }),
      stRotation: 0,
    },
  });
};
// xoá la kinh vừa tạo
window.removeImageOnTerrain = function () {
  if (currentImageEntity) {
    viewer.entities.remove(currentImageEntity);
    currentImageEntity = null;
  } else {
    console.warn("There are no photos to delete.");
  }
};
// bay đến vị trí tìm kiếm
function flyToLocation(lat, lon, height) {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lon, lat, height || 1000.0),
    duration: 2.0,
  });
}

// bay đến vị trí hiện tại
window.flyToCurrentLocation = function () {
  if (!navigator.geolocation) {
    alert("The browser does not support geolocation.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(lon, lat, 1000),
        duration: 2,
        complete: () => {
          console.log("Flew to current location:", lat, lon);
        },
      });
    },
    (error) => {
      alert("Unable to get current location: " + error.message);
    }
  );
};

initCesium();
// Đổi màu la kinh
document
  .getElementById("colorPickerInput")
  .addEventListener("input", function (e) {
    const hex = e.target.value;
    const cesiumColor = Cesium.Color.fromCssColorString(hex).withAlpha(1.0);

    if (currentImageEntity) {
      currentImageEntity.rectangle.material.color = cesiumColor;
    }
  });
// select color when input[type="color
document.querySelector(".color-picker-item").addEventListener("click", (e) => {
  // Nếu click KHÔNG phải là chính input thì focus input
  if (e.target.tagName.toLowerCase() !== "input") {
    e.currentTarget.querySelector('input[type="color"]').click();
  }
});
// Action click item menu
document.querySelectorAll(".menu-item").forEach((item) => {
  item.addEventListener("click", () => {
    document
      .querySelectorAll(".menu-item")
      .forEach((i) => i.classList.remove("active"));
    item.classList.add("active");
  });
});
// Hiệu ứng đóng mở menu
const toggleBtn = document.getElementById("menuToggleBtn");
const menu = document.getElementById("floatingMenu");

let isMenuOpen = false;

toggleBtn.addEventListener("click", () => {
  toggleMenu();
});

window.toggleMenu = function () {
  isMenuOpen = !isMenuOpen;

  if (isMenuOpen) {
    menu.style.display = "flex"; // Hiện lại để animate
    setTimeout(() => {
      menu.classList.add("show");
    }, 10); // delay nhỏ để kích hoạt transition
    toggleBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  } else {
    menu.classList.remove("show");
    toggleBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
    // Đợi animation xong mới display:none
    setTimeout(() => {
      menu.style.display = "none";
    }, 300);
  }
};
