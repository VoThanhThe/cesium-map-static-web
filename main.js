// defaultAccessToken được tạo ra khi đăng kí tài khoản cesium js: https://cesium.com/platform/cesiumjs/
Cesium.Ion.defaultAccessToken = window.CESIUM_TOKEN;
let viewer;
let currentImageEntity = null;

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

function getSelectedLang() {
  const selected = document.querySelector(
    ".dropdown-item[data-selected='true']"
  );
  return selected ? selected.getAttribute("data-lang") : "vn";
}

function getSelectedImagePath() {
  const selected = document.querySelector(
    ".dropdown-item[data-selected='true']"
  );
  return selected ? selected.getAttribute("data-image") : "";
}

async function initCesium() {
  viewer = new Cesium.Viewer("cesiumContainer", {
    terrain: Cesium.Terrain.fromWorldTerrain({
      requestVertexNormals: true,
    }),
    geocoder: false,
    timeline: false,
    animation: false,
    fullscreenButton: false,
    baseLayerPicker: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    selectionIndicator: false,
    navigationHelpButton: false,
    navigationInstructionsInitiallyVisible: false,
    vrButton: false,
    shouldAnimate: true,
  });

  viewer.scene.globe.enableLighting = true;
  viewer.scene.globe.depthTestAgainstTerrain = true;

  const buildingTileset = await Cesium.createOsmBuildingsAsync();
  viewer.scene.primitives.add(buildingTileset);

  flyToDefaultView();
}

function flyToDefaultView() {
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

window.flyToDefaultView = flyToDefaultView;

window.flyToLocation = function (name, lat, lon, height) {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lon, lat, height || 1000.0),
    duration: 2.0,
  });

  viewer.entities.removeAll();

  viewer.entities.add({
    name: "Điểm tìm kiếm",
    position: Cesium.Cartesian3.fromDegrees(lon, lat),
    billboard: {
      image: "images/ic_marker_map.png",
      width: 32,
      height: 32,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      scaleByDistance: new Cesium.NearFarScalar(1000, 2.0, 10000000, 1.2),
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
        0.0,
        20000000.0
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
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      showBackground: true,
      backgroundColor: Cesium.Color.WHITE,
    },
  });
};

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
  const sizeInMeters = cameraHeight / 2;

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
  const imageUrl = getSelectedImagePath();

  // 👉 Hiển thị loading
  const loadingSpinner = document.getElementById("loadingSpinner");
  loadingSpinner.style.display = "block";

  const image = new Image();
  image.onload = () => {
    loadingSpinner.style.display = "none"; // ✅ Ẩn loading khi ảnh load xong

    currentImageEntity = viewer.entities.add({
      rectangle: {
        coordinates: rectangle,
        material: new Cesium.ImageMaterialProperty({
          image: image,
          transparent: true,
          color: initialColor,
        }),
        stRotation: 0,
      },
    });
  };

  image.onerror = () => {
    loadingSpinner.style.display = "none";
    console.error("Lỗi khi tải ảnh:", imageUrl);
  };

  image.src = imageUrl;
};

window.removeImageOnTerrain = function () {
  if (currentImageEntity) {
    viewer.entities.remove(currentImageEntity);
    currentImageEntity = null;
  } else {
    console.warn("There are no photos to delete.");
  }
};

window.flyToCurrentLocation = function () {
  const lang = getSelectedLang();
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

const flagSelectorToggle = document.getElementById("flagSelectorToggle");
const flagDropdown = document.getElementById("flagDropdown");
const selectedFlag = document.getElementById("selected-flag");

flagSelectorToggle.addEventListener("click", (e) => {
  flagDropdown.classList.toggle("hidden");
});

document.querySelectorAll(".dropdown-item").forEach((item) => {
  item.addEventListener("click", () => {
    document
      .querySelectorAll(".dropdown-item")
      .forEach((i) => i.removeAttribute("data-selected"));
    item.setAttribute("data-selected", "true");

    const lang = item.getAttribute("data-lang");
    const imageUrl = item.getAttribute("data-image");
    selectedFlag.textContent = item.textContent.trim().split(" ")[0];
    updateMenuLanguage(lang);
    flagDropdown.classList.add("hidden");

    // ✅ Cập nhật ảnh realtime nếu đang có la kinh
    if (currentImageEntity) {
      const currentMaterial = currentImageEntity.rectangle.material;
      const currentColor =
        currentMaterial.color?.getValue(Cesium.JulianDate.now()) ??
        Cesium.Color.WHITE;

      currentImageEntity.rectangle.material = new Cesium.ImageMaterialProperty({
        image: imageUrl,
        transparent: true,
        color: currentColor,
      });
    }
  });
});

document.addEventListener("click", (e) => {
  if (!flagSelectorToggle.contains(e.target)) {
    flagDropdown.classList.add("hidden");
  }
});

document.querySelectorAll(".menu-item").forEach((item) => {
  item.addEventListener("click", () => {
    document
      .querySelectorAll(".menu-item")
      .forEach((i) => i.classList.remove("active"));
    item.classList.add("active");
  });
});

function updateMenuLanguage(lang) {
  const labels = languageMap[lang];
  if (labels) {
    const menuItems = document.querySelectorAll(".menu-item");
    if (menuItems.length >= 4) {
      menuItems[0].querySelector("span").textContent = labels.addImage;
      menuItems[1].querySelector("span").textContent = labels.removeImage;
      menuItems[2].querySelector("span").textContent = labels.flyToMyLocation;
      menuItems[3].querySelector("span").textContent = labels.flyToPlace;
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("homeViewBtn")?.addEventListener("click", () => {
    window.flyToDefaultView();
  });
  const selected = document.querySelector(
    ".dropdown-item[data-selected='true']"
  );
  if (!selected) {
    const defaultItem = document.querySelector(
      ".dropdown-item[data-lang='vn']"
    );
    defaultItem?.setAttribute("data-selected", "true");
    selectedFlag.textContent =
      defaultItem?.textContent.trim().split(" ")[0] || "🇻🇳";
  }

  const defaultLang = getSelectedLang();
  updateMenuLanguage(defaultLang);
});
