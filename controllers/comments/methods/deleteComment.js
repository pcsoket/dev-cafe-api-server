const mongoose = require('mongoose');

const { ObjectId } = mongoose.Types;

const { wrapAsync } = require('../../../util/util');
const Comment = require('../../../models/comment');

module.exports = wrapAsync(async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    res.status(400);
    return res.json({ message: 'commentId 형식이 잘못되었습니다.' });
  }

  const comment = await Comment.findById(id);

  if (!comment) {
    return res.status(404).end();
  }

  if (comment.author.toString() !== req.user._id) {
    res.status(401);
    return res.json({ message: '자신이 쓴 댓글만 삭제할 수 있습니다.' });
  }

  if (comment.childComments.length > 0) {
    await Comment.findByIdAndUpdate(comment._id, { $set: { contents: '삭제된 댓글입니다.', isDeleted: true } });
    return res.status(204).end();
  }

  await Comment.findByIdAndDelete(id);

  return res.status(204).end();
});
