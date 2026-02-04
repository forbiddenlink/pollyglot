// Redirect root to index.html
module.exports = (req, res) => {
  res.writeHead(301, { Location: '/index.html' });
  res.end();
};
