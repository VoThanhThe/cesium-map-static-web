Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIzODY4ZmY1OC0xNWVjLTQ1ZTctYjM5Yi1hN2VkMDExMWZjMzUiLCJpZCI6MzEwNDg1LCJpYXQiOjE3NDk0NTk5MjN9.ZwtBDfv0ynlRlWa9NZNQx8b5S5u-EJmKyIYKmPa3qWg';

let viewer;
let currentImageEntity = null;

async function initCesium() {
  viewer = new Cesium.Viewer('cesiumContainer', {
    terrain: Cesium.Terrain.fromWorldTerrain({
      requestVertexNormals: true,
    }),
  });

  viewer.scene.globe.enableLighting = true;
  viewer.scene.globe.depthTestAgainstTerrain = true;

  const buildingTileset = await Cesium.createOsmBuildingsAsync();
  viewer.scene.primitives.add(buildingTileset);

  viewer.camera.flyTo({
    destination: Cesium.Rectangle.fromDegrees(102.14441, 8.3817, 109.4642, 23.3934),
    duration: 3,
    complete: function () {
      viewer.camera.setView({
        orientation: {
          heading: viewer.camera.heading,
          pitch: Cesium.Math.toRadians(-90),
          roll: 0
        }
      });
    }
  });
}

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
    const lonDeg = meters / (111320 * Math.cos(Cesium.Math.toRadians(latitude)));
    return { latDeg, lonDeg };
  }

  const halfSizeMeters = sizeInMeters / 2;
  const { latDeg: halfHeightDegrees, lonDeg: halfWidthDegrees } = metersToDegrees(halfSizeMeters, centerLat);

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
        image: 'images/img_compass_satellite.png',
        transparent: true,
        color: initialColor
      }),
      stRotation: 0,
    }
  });
};

window.removeImageOnTerrain = function () {
  if (currentImageEntity) {
    viewer.entities.remove(currentImageEntity);
    currentImageEntity = null;
  } else {
    console.warn("Không có ảnh nào để xoá");
  }
};

window.flyToCurrentLocation = function () {
  if (!navigator.geolocation) {
    alert("Trình duyệt không hỗ trợ định vị.");
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
          console.log("Đã bay đến vị trí hiện tại:", lat, lon);
        }
      });
    },
    (error) => {
      alert("Không thể lấy vị trí hiện tại: " + error.message);
    }
  );
};

initCesium();

document.getElementById("colorPickerInput").addEventListener("input", function (e) {
  const hex = e.target.value;
  const cesiumColor = Cesium.Color.fromCssColorString(hex).withAlpha(1.0);

  if (currentImageEntity) {
    currentImageEntity.rectangle.material.color = cesiumColor;
  }
});

document.querySelectorAll('.menu-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
  });
});
