/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const Post = require('../models/post');

const reqPostPosts = (userToken, post) => requester
  .post(`${API_URI}/posts`)
  .set('x-access-token', userToken)
  .send({ ...post });

const samplePost = {
  title: 'hello world',
  contents: '#include<stdio.h>',
  categoryId: null,
};

const reqGetPost = postId => requester
  .get(`${API_URI}/posts/${postId}`);

describe('Posts', () => {
  let token;
  let parentCategory;
  let childCategory;
  const user = copyAndFreeze(USER_ARRAY[0]);

  before((done) => {
    dropDatabase(done);
  });

  before(async () => {
    // 회원가입
    const register = await reqRegister(user);
    register.should.have.status(201);

    // 로그인
    const login = await reqLogin(user.username, user.password);
    login.should.have.status(201);
    token = login.body.accessToken;

    // 상위 카테고리 생성
    parentCategory = new TestCategory('parent');
    const parentC = await reqPostCategories(parentCategory);
    parentC.should.have.status(201);

    // 하위 카테고리 생성
    childCategory = new TestCategory('child', parentC.body.categoryId);
    const childC = await reqPostCategories(childCategory);
    childC.should.have.status(201);
    samplePost.categoryId = childC.body.categoryId;
  });

  after((done) => {
    dropDatabase(done);
  });

  describe('POST /posts', () => {
    before((done) => {
      clearCollection(Post, done);
    });

    afterEach((done) => {
      clearCollection(Post, done);
    });

    it('성공하면 201코드, postId를 반환한다', async () => {
      const res = await reqPostPosts(token, samplePost);
      res.should.have.status(201);
      res.body.should.have.property('postId');

      const post = await Post.findById(res.body.postId);
      should.exist(post);
      assert.equal(post.title, samplePost.title);
      assert.equal(post.contents, samplePost.contents);
      assert.equal(post.category, samplePost.categoryId);
    });

    it('토큰이 없으면 401코드를 반환한다', async () => {
      const res = await reqPostPosts(null, samplePost);
      res.should.have.status(401);

      const post = await Post.findOne({ title: samplePost.title });
      should.not.exist(post);
    });

    it('카테고리 id가 invalid하면 400코드를 반환한다', async () => {
      const wrongPost = copyAndFreeze(samplePost);
      wrongPost.categoryId = 'WRONG_ID';

      const res = await reqPostPosts(token, wrongPost);
      res.should.have.status(400);

      const post = await Post.findOne({ title: wrongPost.title });
      should.not.exist(post);
    });

    it('제목, 내용, 카테고리 누락시 400코드를 반환한다', async () => {
      const titleX = copyAndFreeze(samplePost);
      const contentsX = copyAndFreeze(samplePost);
      const categoryX = copyAndFreeze(samplePost);

      titleX.title = '   ';
      contentsX.contents = '';
      categoryX.categoryId = null;

      const res1 = reqPostPosts(token, titleX);
      const res2 = reqPostPosts(token, contentsX);
      const res3 = reqPostPosts(token, categoryX);

      const results = await Promise.all([res1, res2, res3]);
      results[0].should.have.status(400);
      results[1].should.have.status(400);
      results[2].should.have.status(400);

      const post = await Post.findOne({ title: contentsX.title });
      should.not.exist(post);
    });

    it('카테고리가 존재하지 않으면 404코드를 반환한다', async () => {
      const wrongPost = copyAndFreeze(samplePost);
      wrongPost.categoryId = new ObjectId();

      const res = await reqPostPosts(token, wrongPost);
      res.should.have.status(404);

      const post = await Post.findOne({ title: wrongPost.title });
      should.not.exist(post);
    });
  });

  describe('GET /posts/:id', () => {
    let postId;
    before(async () => {
      const res = await reqPostPosts(token, samplePost);
      res.should.have.status(201);
      ({ postId } = res.body);
    });

    after((done) => {
      clearCollection(Post, done);
    });

    it('성공하면 200코드, post를 반환한다', async () => {
      const res = await reqGetPost(postId);
      res.should.have.status(200);
      res.body.should.have.property('post');

      const { post } = res.body;
      assert.equal(post.title, samplePost.title);
      assert.equal(post.author.profileName, user.profileName);
      assert.equal(post.category.name, childCategory.name);
      assert.equal(post.category.parent.name, parentCategory.name);
    });

    it('post가 없으면 404코드를 반환한다', async () => {
      const res = await reqGetPost(new ObjectId());
      res.should.have.status(404);
      should.not.exist(res.body.post);
    });

    it('postId가 invalid하다면 400코드를 반환한다', async () => {
      const res = await reqGetPost('INVALID_ID');
      res.should.have.status(400);
      should.not.exist(res.body.post);
    });
  });
});
