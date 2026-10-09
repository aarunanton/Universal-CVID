/* Landing page: fill in the machine-readable lines on the sample ID card */
(function () {
  var lines = UCV.mrz('#UCVID-K7Q4M', 'Maya Okafor', 'Senior Product Designer');
  var mrz = document.getElementById('heroMrz'); if (mrz) mrz.textContent = lines[0] + '\n' + lines[1];
})();
