/* Landing page: fill in the machine-readable lines on the sample ID card */
(function () {
  var lines = UCV.mrz('#UCVID-K7Q4M', 'Maya Okafor', 'Senior Product Designer');
  document.getElementById('heroMrz').textContent = lines[0] + '\n' + lines[1];
})();
