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
  viewer.homeButton.viewModel.command.beforeExecute.addEventListener(function (
    e
  ) {
    e.cancel = true; // ✅ ngăn mặc định

    // Gán toạ độ mới (VD: TP.HCM)
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

  const imageSelect = document.getElementById("imageSelect");
  const imageUrl = imageSelect.options[imageSelect.selectedIndex].dataset.image;

  currentImageEntity = viewer.entities.add({
    rectangle: {
      coordinates: rectangle,
      material: new Cesium.ImageMaterialProperty({
        image: imageUrl,
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
window.flyToLocation = function (name, lat, lon, height) {
  // Bay đến vị trí
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lon, lat, height || 1000.0),
    duration: 2.0,
  });

  // Xóa các marker cũ (nếu muốn)
  viewer.entities.removeAll();

  // Thêm marker mới
  viewer.entities.add({
    name: "Điểm tìm kiếm",
    position: Cesium.Cartesian3.fromDegrees(lon, lat),
    billboard: {
      image: "images/ic_marker_map.png",
      width: 32,
      height: 32,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY, // 👈 Luôn hiển thị
      scaleByDistance: new Cesium.NearFarScalar(
        1000,
        2.0, // Gần (1km): to rõ
        10000000,
        1.2 // Xa (10,000km): vẫn còn nhìn thấy (dù nhỏ hơn 1 chút)
      ),
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
        0.0,
        20000000.0 // Hiển thị lên tới 20,000km (~bán kính Trái Đất)
      ),
      eyeOffset: new Cesium.Cartesian3(0.0, 0.0, -10.0),
    },
    label: {
      text: name,
      font: "14px sans-serif",
      fillColor: Cesium.Color.BLACK,
      style: Cesium.LabelStyle.FILL,
      outlineWidth: 1,
      verticalOrigin: Cesium.VerticalOrigin.TOP,
      pixelOffset: new Cesium.Cartesian2(0, -85),
      heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY, // 👈 Luôn hiển thị
      showBackground: true,
      backgroundColor: Cesium.Color.WHITE,
    },
  });
};

// ✅ Bay đến vị trí hiện tại và thêm marker
window.flyToCurrentLocation = function () {
  const lang = document.getElementById("imageSelect").value;
  const labels = languageMap[lang] || languageMap["vn"];

  if (!navigator.geolocation) {
    alert(labels.errorNoGeolocation);
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      window.flyToLocation(labels.myLocation, lat, lon, 500);
    },
    (error) => {
      alert(`${labels.errorLocationFailed}: ${error.message}`);
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

/// LANGUAGE
const languageMap = {
  vn: {
    addImage: "Thêm ảnh",
    removeImage: "Xóa ảnh",
    flyToMyLocation: "Vị trí của tôi",
    myLocation: "Vị trí của tôi",
    errorNoGeolocation: "Trình duyệt không hỗ trợ định vị vị trí.",
    errorLocationFailed: "Không thể lấy vị trí hiện tại",
  },
  en: {
    addImage: "Add Image",
    removeImage: "Remove Image",
    flyToMyLocation: "Fly to My Location",
    myLocation: "My Location",
    errorNoGeolocation: "The browser does not support geolocation.",
    errorLocationFailed: "Unable to get current location",
  },
  zh: {
    addImage: "添加图片",
    removeImage: "删除图片",
    flyToMyLocation: "我的位置",
    myLocation: "我的位置",
    errorNoGeolocation: "浏览器不支持定位功能。",
    errorLocationFailed: "无法获取当前位置",
  },
};

// Hàm cập nhật text menu theo ngôn ngữ
function updateMenuLanguage(lang) {
  const labels = languageMap[lang];
  if (labels) {
    const menuItems = document.querySelectorAll(".menu-item");

    menuItems[0].querySelector("span").textContent = labels.addImage;
    menuItems[1].querySelector("span").textContent = labels.removeImage;
    menuItems[2].querySelector("span").textContent = labels.flyToMyLocation;
    menuItems[3].querySelector("span").textContent = labels.flyToPlace;
  }
}

// Bắt sự kiện đổi ngôn ngữ từ select
document.getElementById("imageSelect").addEventListener("change", (e) => {
  const lang = e.target.value;
  updateMenuLanguage(lang);
});

// ✅ Gọi hàm đổi ngôn ngữ ngay khi trang tải lần đầu
window.addEventListener("DOMContentLoaded", () => {
  const defaultLang = document.getElementById("imageSelect").value;
  updateMenuLanguage(defaultLang);
});
