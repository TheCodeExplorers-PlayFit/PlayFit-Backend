const express = require('express');
const router = express.Router();
const { getPendingBlogs, approveBlog, rejectBlog } = require('../controllers/adminBlogsController');

// Routes
router.get('/pending', getPendingBlogs); // Fetch all pending blogs (verified = 0)
router.put('/approve/:id', approveBlog); // Approve a blog (set verified = 1)
router.delete('/reject/:id', rejectBlog); // Reject a blog (delete it)

module.exports = router;