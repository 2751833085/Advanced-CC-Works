(function () {
  window.TIANJI_YI = window.TIANJI_YI || {};
  fetch("data/tianji-yi.json")
    .then(function (r) {
      return r.ok ? r.json() : {};
    })
    .then(function (data) {
      window.TIANJI_YI = data || {};
    })
    .catch(function () {
      window.TIANJI_YI = {};
    });
})();
