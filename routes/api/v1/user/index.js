const userRouter = require('express').Router();
const users = require('../../../../controllers/users');
const { isAuthenticated } = require('../../../../middleware/authenticator');
/*
 *      /api/v1/users'
 */
userRouter.get('/', users.getUsers);
userRouter.post('/', users.register);

userRouter.get('/me', isAuthenticated, users.getMyInfo);
userRouter.get('/:id', users.getUserById);

userRouter.delete('/me', isAuthenticated, users.unRegister);
module.exports = userRouter;
