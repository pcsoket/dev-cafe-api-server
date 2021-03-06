const User = require('../../../models/user');

module.exports = (req, res) => {
  User.findById(req.params.id)
    .lean()
    .then((user) => {
      res.setHeader('Content-Type', 'application/json');
      return res.json(user);
    })
    .catch((err) => {
      throw err;
    });
};
