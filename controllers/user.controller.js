const User = require('../models/user');
const jwt = require('jsonwebtoken');
const JwtSecretKey = require('../config/config').JwtSecretKey;
const wrapAsync = require('../util/util').wrapAsync;
const USER_MESSAGE = require('../constants/message').USER;

exports.getUsers = (req, res) => {
  User.find({})
    .lean()
    .then(users => {
      res.setHeader('Content-Type', 'application/json');
      return res.json(users);
    })
    .catch(err => {
      throw err;
    });
};

exports.getUserById = (req, res) => {
  User.findById(req.params.id)
    .lean()
    .then(user => {
      res.setHeader('Content-Type', 'application/json');
      return res.json(user);
    })
    .catch(err => {
      throw err;
    });
};

exports.login = (req, res, next) => {
  User.findOne({ email: req.body.email })
    .then(user => {
      if (!user.validPassword(req.body.password)) {
        throw new Error('Password is not valid');
      }

      const payload = {
        _id: user._id,
        email: user.email,
      };
      const secretOrPrivateKey = JwtSecretKey;
      const options = { expiresIn: 60 * 60 * 24 };

      jwt.sign(payload, secretOrPrivateKey, options, (err, token) => {
        if (err) {
          throw err;
        }

        const result = { success: true, token: token };

        res.json(result);
      });
    })
    .catch(err => {
      next(err);
    });
};

exports.register = wrapAsync(async (req, res) => {
  let userName = req.body.userName;
  let profileName = req.body.profileName;
  let email = req.body.email;
  let password = req.body.password;
  let confirmPassword = req.body.confirmPassword;

  if (!userName || !profileName || !email || !password || !confirmPassword) {
    res.status(403);
    return res.json({ message: USER_MESSAGE.ERROR.EMPTY_USERINFO });
  }

  if (password !== confirmPassword) {
    res.status(403);
    return res.json({ message: USER_MESSAGE.ERROR.WRONG_COMFIRM_PASSWORD });
  }

  const regex = /^.*(?=^.{8,20}$)(?=.*\d)(?=.*[a-zA-Z])(?=.*[!@#$\*%^&+=]).*$/;

  if (!regex.test(password)) {
    res.status(403);
    return res.json({
      message: USER_MESSAGE.ERROR.INVALID_PASSWORD,
    });
  }

  const emailRule = /^[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*@[0-9a-zA-Z]([-_.]?[0-9a-zA-Z])*.[a-zA-Z]{2,3}$/i;

  if (!emailRule.test(email)) {
    res.status(403);
    return res.json({
      message: USER_MESSAGE.ERROR.INVALID_EMAIL,
    });
  }

  let oldUser = await User.findOne({
    $or: [{ userName: userName }, { email: email }],
  });

  if (!!oldUser) {
    res.status(403);
    return res.json({
      message: USER_MESSAGE.ERROR.DUPLICATED_USERINFO,
    });
  }

  let user = new User();

  user.userName = userName;
  user.profileName = profileName;
  user.email = email;
  user.password = user.generateHash(password);

  await User.create(user).then(user => {
    res.status(201);
    res.json({ profileName: user.profileName, email: user.email });
  });
});
