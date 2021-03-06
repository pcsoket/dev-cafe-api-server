/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { AUTH_ERR } = require('../constants/message');
const User = require('../models/user');
const App = require('./helpers/App');

describe('Auth', () => {
  const testUser = copyAndFreeze(USER_ARRAY[0]);

  describe('POST /auth', () => {
    before(async () => {
      await clearCollection(User);
    });
    before(async () => {
      const res = await App.reqRegister(testUser);

      res.should.have.status(201);
    });
    after(async () => {
      await clearCollection(User);
    });

    it('로그인에 성공하면 response로 201 code와 엑세스 토큰을 받아야한다', async () => {
      const res = await App.reqLogin(testUser.username, testUser.password);

      res.should.have.status(201);
      res.should.be.json;
      res.body.should.have.property('accessToken');
    });

    it('존재하지 않는 유저라면 response로 403 error와 WRONG_USERNAME message를 받아야한다', async () => {
      const res = await App.reqLogin('ImNotExist', testUser.password);

      res.should.have.status(403);
      res.should.be.json;
      res.body.should.have.property('message', AUTH_ERR.WRONG_USERNAME);
    });

    it('비밀번호가 잘못되었다면 response로 403 error와 WRONG_PASSWORD message를 받아야한다', async () => {
      const res = await App.reqLogin(testUser.username, 'WrongPassword');

      res.should.have.status(403);
      res.should.be.json;
      res.body.should.have.property('message', AUTH_ERR.WRONG_PASSWORD);
    });

    it('사용자이름/비밀번호를 입력하지 않았다면 400 error와 EMPTY_LOGINFORM message를 받아야한다', async () => {
      const emptyPassword = App.reqLogin(testUser.username, '');
      const emptyUsername = App.reqLogin('', testUser.password);

      const results = await Promise.all([emptyPassword, emptyUsername]);
      const emptyPasswordResponse = results[0];
      const emptyUsernameResponse = results[1];

      emptyPasswordResponse.should.have.status(400);
      emptyPasswordResponse.body.should.have.property(
        'message',
        AUTH_ERR.EMPTY_LOGINFORM
      );

      emptyUsernameResponse.should.have.status(400);
      emptyUsernameResponse.body.should.have.property(
        'message',
        AUTH_ERR.EMPTY_LOGINFORM
      );
    });
  });
});
