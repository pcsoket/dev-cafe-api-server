/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const Comment = require('../models/comment');

describe('comments', () => {
  let token;
  let postId1;
  let postId2;
  const user = copyAndFreeze(USER_ARRAY[0]);

  const reqGetComments = (query) => {
    const queryString = query || '';
    return requester
      .get(`${API_URI}/comments?${queryString}`);
  };

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
    const parentCategory = new TestCategory('parent');
    const parentC = await reqPostCategories(token, parentCategory);
    parentC.should.have.status(201);

    // 하위 카테고리 생성
    const childCategory = new TestCategory('child', parentC.body.categoryId);
    const childC = await reqPostCategories(token, childCategory);
    childC.should.have.status(201);
    const childCategoryId = childC.body.categoryId;

    // 글 2개 작성
    const testPost = new TestPost({
      title: 'testTitle',
      contents: 'hello',
      categoryId: childCategoryId,
    });
    const testPost2 = new TestPost({
      title: 'testTitle',
      contents: 'hello',
      categoryId: childCategoryId,
    });

    const reqPost = reqPostPosts(token, testPost);
    const reqPost2 = reqPostPosts(token, testPost2);

    const responses = await Promise.all([reqPost, reqPost2]);
    responses[0].should.have.status(201);
    responses[1].should.have.status(201);

    postId1 = responses[0].body.postId;
    postId2 = responses[1].body.postId;
  });

  after((done) => {
    dropDatabase(done);
  });

  describe('POST /comments', () => {
    afterEach((done) => {
      clearCollection(Comment, done);
    });

    it('성공하면 201코드, commentId를 반환한다', async () => {
      const testComment = new TestComment({
        contents: 'test',
        postId: postId1,
        parent: null,
      });
      const res = await reqPostComments(token, testComment);
      res.should.have.status(201);
      res.body.should.have.property('commentId');

      const comment = await Comment.findById(res.body.commentId);
      should.exist(comment);
      assert.equal(comment.contents, testComment.contents);
      assert.equal(comment.post, testComment.postId);
    });

    it('내용 or postId가 누락되면 400코드를 반환한다', async () => {
      const emptyContents = new TestComment({
        contents: '',
        postId: postId1,
        parent: null,
      });

      const emptyPostId = new TestComment({
        contents: 'noPostId',
        postId: null,
        parent: null,
      });

      const req1 = reqPostComments(token, emptyContents);
      const req2 = reqPostComments(token, emptyPostId);

      const responses = await Promise.all([req1, req2]);

      responses[0].should.have.status(400);
      responses[1].should.have.status(400);

      const comments = await Comment.find({});
      comments.length.should.be.equal(0);
    });

    it('postId가 invalid하면 400코드를 반환한다', async () => {
      const invalidPostId = new TestComment({
        contents: 'test',
        postId: 'INVALID_POST_ID',
        parent: null,
      });
      const res = await reqPostComments(token, invalidPostId);
      res.should.have.status(400);

      const comments = await Comment.find({});
      comments.length.should.be.equal(0);
    });

    it('토큰이 누락되면 401코드를 반환한다', async () => {
      const testComment = new TestComment({
        contents: 'test',
        postId: postId1,
        parent: null,
      });
      const res = await reqPostComments(null, testComment);
      res.should.have.status(401);

      const comments = await Comment.find({});
      comments.length.should.be.equal(0);
    });

    it('post가 존재하지않으면 404코드를 반환한다', async () => {
      const notExistPostId = new TestComment({
        contents: 'test',
        postId: new ObjectId(),
        parent: null,
      });

      const res = await reqPostComments(token, notExistPostId);
      res.should.have.status(404);

      const comments = await Comment.find({});
      comments.length.should.be.equal(0);
    });

    context('자식 댓글을 생성할 때', () => {
      let parentCommentId;
      before(async () => {
        const parentComment = new TestComment({
          contents: 'parentComment',
          postId: postId1,
          parent: null,
        });

        const resParent = await reqPostComments(token, parentComment);
        resParent.should.have.status(201);

        parentCommentId = resParent.body.commentId;
      });
      it('성공하면 201코드, commentId를 반환한다', async () => {
        const childComment = new TestComment({
          contents: 'childComment',
          postId: postId1,
          parent: parentCommentId,
        });

        const res = await reqPostComments(token, childComment);
        res.should.have.status(201);
        const childCommentId = res.body.commentId;

        const child = await Comment.findById(childCommentId);
        assert.equal(child.isChild, true);
        assert.equal(child.parent, childComment.parent);
      });
      it('부모댓글이 없으면 404코드를 반환한다', async () => {
        const orphanComment = new TestComment({
          contents: 'no Parent',
          postId: new ObjectId(),
          parent: null,
        });

        const res = await reqPostComments(token, orphanComment);
        res.should.have.status(404);

        const orphanDoc = await Comment
          .findOne({ contents: orphanComment.contents });
        should.not.exist(orphanDoc);
      });
      it('parentId가 invalid하면 400코드를 반환한다', async () => {
        const invalidParentId = new TestComment({
          contents: 'test',
          postId: 'INVALID_PARENTID',
          parent: null,
        });

        const res = await reqPostComments(token, invalidParentId);
        res.should.have.status(400);

        const invalidPidDoc = await Comment
          .findOne({ contents: invalidParentId.contents });
        should.not.exist(invalidPidDoc);
      });
    });
  });

  describe('GET /comments', () => {
    let commentIdInPost1;
    let commentIdInPost2;
    let childCommentId1;
    let childCommentId2;


    const TOTAL_PARENT_COMMENTS_IN_POST1 = 40;
    const TOTAL_CHILD_COMMENTS_IN_POST1 = 2;
    const TOTAL_COMMENTS_IN_POST1 = TOTAL_PARENT_COMMENTS_IN_POST1 + TOTAL_CHILD_COMMENTS_IN_POST1;

    const TOTAL_PARENT_COMMENTS_IN_POST2 = 1;
    const TOTAL_CHILD_COMMENTS_IN_POST2 = 0;
    const TOTAL_COMMENTS_IN_POST2 = TOTAL_PARENT_COMMENTS_IN_POST2 + TOTAL_CHILD_COMMENTS_IN_POST2;

    const TOTAL_COMMENTS = TOTAL_COMMENTS_IN_POST1 + TOTAL_COMMENTS_IN_POST2;

    const DEFAULT_LIMIT = 30;

    after((done) => {
      clearCollection(Comment, done);
    });
    context('댓글이 없으면', () => {
      it('404코드를 반환한다', async () => {
        const res = await reqGetComments();
        res.should.have.status(404);
      });
    });

    context('댓글이 있을 때', () => {
      before(async () => {
        // post1에 부모 댓글 40개, post2에 부모 댓글 1개 작성

        // - post1에 부모 댓글 39개
        const extraCommentForPost1 = new TestComment({
          contents: 'An extra comment in post1',
          postId: postId1,
          parent: null,
        });

        const reqExtra39Comments = new Array(TOTAL_PARENT_COMMENTS_IN_POST1 - 1).fill(null)
          .map(() => reqPostComments(token, extraCommentForPost1));

        await Promise.all(reqExtra39Comments);

        // post1, post2에 부모 댓글 1개씩
        const commentForPost1 = new TestComment({
          contents: 'I live in post1',
          postId: postId1,
          parent: null,
        });

        const commentForPost2 = new TestComment({
          contents: 'I live in post2',
          postId: postId2,
          parent: null,
        });

        const res1 = await reqPostComments(token, commentForPost1);
        const res2 = await reqPostComments(token, commentForPost2);


        commentIdInPost1 = res1.body.commentId;
        commentIdInPost2 = res2.body.commentId;

        // post1에 있는 최신 댓글에 자식 댓글 2개 작성
        const childComment1 = new TestComment({
          contents: 'child1',
          postId: postId1,
          parent: commentIdInPost1,
        });
        const childComment2 = new TestComment({
          contents: 'child2',
          postId: postId1,
          parent: commentIdInPost1,
        });

        const resChild1 = await reqPostComments(token, childComment1);
        const resChild2 = await reqPostComments(token, childComment2);

        childCommentId1 = resChild1.body.commentId;
        childCommentId2 = resChild2.body.commentId;
      });

      context('GET /comments 요청이 성공하면', () => {
        let response;
        let comments;
        before(async () => {
          response = await reqGetComments();
          comments = response.body;
        });
        it('200코드를 반환한다', async () => {
          response.should.have.status(200);
        });
        it('limit이 설정되지 않은 경우, 30개의 댓글을 반환한다', async () => {
          assert.notEqual(comments.length, TOTAL_COMMENTS);
          assert.equal(comments.length, DEFAULT_LIMIT);
        });

        it('최신 댓글이 배열의 첫번째에 위치한다', async () => {
          assert.equal(comments[0]._id, childCommentId2);
          assert.equal(comments[1]._id, childCommentId1);
        });
        it('댓글에는 작성자의 profileName이 포함되어 있다', async () => {
          comments.forEach((comment) => {
            comment.author.should.have.property('profileName');
            assert(comment.author.profileName, user.profileName);
          });
        });
      });

      context('post(Id)를 쿼리스트링으로 지정하면', () => {
        it('200코드, 해당되는 comments를 반환한다', async () => {
          const query = `post=${postId2}`;
          const res = await reqGetComments(query);
          res.should.have.status(200);

          const comments = res.body;
          assert.equal(comments.length, 1);
          assert.equal(comments[0]._id, commentIdInPost2);
        });

        context('자식댓글이 존재한다면', () => {
          it('200코드, 트리구조의 comments를 반환한다.', async () => {
            const query = `post=${postId1}`;
            const res = await reqGetComments(query);
            res.should.have.status(200);

            const comments = res.body;
            assert.equal(comments[0].childComments.length, 2);
            assert.equal(comments[0].childComments[0]._id, childCommentId1);
            assert.equal(comments[0].childComments[1]._id, childCommentId2);
          });
        });
      });
      context('limit을 쿼리스트링으로 지정하면', () => {
        it('지정한 갯수만큼의 댓글을 반환한다', async () => {
          const limit = 3;
          const query = `limit=${limit}`;
          const res = await reqGetComments(query);
          res.should.have.status(200);

          const comments = res.body;
          assert.equal(comments.length, limit);
        });
        context('post(Id)를 쿼리스트링으로 설정했을 때', () => {
          it('limit으로 지정한 갯수 만큼의 부모 댓글을 반환한다', async () => {
            const limit = 3;

            const query = `post=${postId1}&limit=${limit}`;
            const res = await reqGetComments(query);
            res.should.have.status(200);

            const comments = res.body;

            assert.equal(comments.length, limit);
            comments.forEach((comment) => {
              assert.equal(comment.isChild, false);
            });
          });

          it('limit보다 부모 댓글 갯수가 적다면 전체 부모 댓글을 반환한다', async () => {
            const query = `post=${postId1}&limit=${TOTAL_COMMENTS_IN_POST1}`;
            const res = await reqGetComments(query);
            res.should.have.status(200);

            const comments = res.body;

            assert.equal(comments.length, TOTAL_PARENT_COMMENTS_IN_POST1);
            comments.forEach((comment) => {
              assert.equal(comment.isChild, false);
            });
          });
        });
      });


      context('post(Id)가 invalid하면', () => {
        it('400코드를 반환한다', async () => {
          const query = 'post=INVALID_POSTID';
          const res = await reqGetComments(query);
          res.should.have.status(400);
          res.body.should.not.have.property('comments');
        });
      });
      context('허용하지않는 쿼리 파라메터를 사용하면', () => {
        it('400코드를 반환한다', async () => {
          const wrongQuery = 'pAst=22&isAdmin=true';
          const res = await reqGetComments(wrongQuery);
          res.should.have.status(400);
          res.body.should.not.have.property('comments');
        });
      });
    });
  });
});
