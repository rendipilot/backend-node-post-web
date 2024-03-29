const User = require("../models/user");
const Post = require("../models/post");
const bcrypt = require("bcryptjs");
const validator = require("validator");
const jwt = require("jsonwebtoken")
const { clearImage } = require("../util/clearImage");

module.exports = {
  // Example get data method

  // hello(){
  //     return {
  //         text: 'Hello',
  //         views: 25
  //     }
  // }

  createUser: async function ({ userInput }, req) {
    // Error validation
    const errors = [];
    if (!validator.isEmail(userInput.email)) {
      errors.push({ message: "Email is invalid " });
    }

    if (
      validator.isEmpty(userInput.password) ||
      !validator.isLength(userInput.password, { min: 5 })
    ) {
      errors.push({ message: "Password short" });
    }

    if (errors.length > 0) {
      const error = new Error("Invalid input");
      error.data = errors;
      error.code = 422;
      throw error;
    }

    const existingUser = await User.findOne({ email: userInput.email });
    if (existingUser) {
      const error = new Error("User exist already");
      throw error;
    }

    const hashedPw = await bcrypt.hash(userInput.password, 12);

    const user = new User({
      email: userInput.email,
      name: userInput.name,
      password: hashedPw,
    });

    const createdUser = await user.save();
    return { ...createdUser._doc, _id: createdUser._id.toString() };
  },
  login: async function ({ email, password }) {
    try {
      const user = await User.findOne({ email: email });
      if (!user) {
        const error = new Error("User not found");
        error.code = 401;
        throw error;
      }
      const isEqual = await bcrypt.compare(password, user.password);
      if (!isEqual) {
        const error = new Error("Password is Incorrect");
        error.code = 401;
        throw error;
      }

      const token = jwt.sign(
        {
          userId: user._id.toString(),
          email: user.email,
        },
        "pilotkodekey",
        { expiresIn: "1h" }
      );

      return { token: token, userId: user._id.toString() };
    } catch (err) {
        const error = new Error(err);
        error.code = 500;
        throw error;
    }
  },
  createPost: async function ({ postInput }, req) {
    if (!req.isAuth) {
      const error = new Error("Not Authenticated User");
      error.code = 401;
      throw error;
    }

    const errors = [];
    if (
      validator.isEmpty(postInput.title) ||
      !validator.isLength(postInput.title, { min: 5 })
    ) {
      errors.push({ message: "Title is invalid" });
    }

    if (
      validator.isEmpty(postInput.content) ||
      !validator.isLength(postInput.content, { min: 5 })
    ) {
      errors.push({ message: "Content is invalid cant empty" });
    }

    if (errors.length > 0) {
      const error = new Error("Invalid input");
      error.data = errors;
      error.code = 422;
      throw error;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("Invalid user");
      error.code = 401;
      throw error;
    }

    const post = new Post({
      title: postInput.title,
      content: postInput.content,
      imageUrl: postInput.imageUrl,
      creator: user,
    });

    const createdPost = await post.save();

    user.posts.push(createdPost);
    await user.save();

    return {
      ...createdPost,
      _id: this.createPost._id.toString(),
      createdAt: createPost.createdAt.toISOString(),
      updatedAt: createdPost.updatedAt.toISOString(),
    };
  },
  posts: async function ({ page }, req) {
    if (!req.isAuth) {
      const error = new Error("Not Authenticated User");
      error.code = 401;
      throw error;
    }

    if (!page) {
      page = 1;
    }

    const perPage = 2;
    const totalPosts = await Post.find()
      .countDocuments()
      .skip((page - 1) * perPage)
      .limit(perPage);
    const posts = await Post.fingd()
      .sort({ createdAt: -1 })
      .populate("creator");
    return {
      posts: posts.map((p) => {
        return {
          ...p._doc,
          _id: p._id.toString(),
          craetedAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        };
      }),
      totalPosts: totalPosts,
    };
  },
  post: async function ({ id }, req) {
    if (!req.isAuth) {
      const error = new Error("Not Authenticated User");
      error.code = 401;
      throw error;
    }

    if (!id) {
      const error = new Error("Id Not Found");
      error.code = 404;
      throw error;
    }

    const post = await Post.findById(id);

    if (!post) {
      const error = new Error("Post not found");
      error.code = 404;
      throw error;
    }

    return {
      ...post._doc,
      _id: post._id.toString(),
      craetedAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  },
  updatePost: async function ({ id, postInput }, req) {
    if (!req.isAuth) {
      const error = new Error("Not Authenticated User");
      error.code = 401;
      throw error;
    }

    if (!id) {
      const error = new Error("Id Not Found");
      error.code = 404;
      throw error;
    }

    const post = await Post.findById(id).populate("creator");
    if (!post) {
      const error = new Error("Post not found");
      error.code = 404;
      throw error;
    }

    if (post.creator._id.toString() !== req.userId.toString()) {
      const error = new Error("Not the creator");
      error.code = 404;
      throw error;
    }

    const errors = [];
    if (
      validator.isEmpty(postInput.title) ||
      !validator.isLength(postInput.title, { min: 5 })
    ) {
      errors.push({ message: "Title is invalid" });
    }

    if (
      validator.isEmpty(postInput.content) ||
      !validator.isLength(postInput.content, { min: 5 })
    ) {
      errors.push({ message: "Content is invalid cant empty" });
    }

    if (errors.length > 0) {
      const error = new Error("Invalid input");
      error.data = errors;
      error.code = 422;
      throw error;
    }

    post.title = postInput.title;
    post.content = postInput.content;

    if (postInput.imageUrl !== "undifined") {
      post.imageUrl = postInput.imageUrl;
    }
    const updatedPost = await post.save();

    return {
      ...updatedPost,
      _id: updatedPost._id.toString(),
      createdAt: updatedPost.createdAt.toISOString(),
      updatedAt: updatedPost.updatedAt.toISOString(),
    };
  },
  deletePost: async function ({ id }, req) {
    if (!req.isAuth) {
      const error = new Error("Not Authenticated User");
      error.code = 401;
      throw error;
    }

    const post = await Post.findById(id);

    if (!post) {
      const error = new Error("Post not found");
      error.code = 404;
      throw error;
    }

    if (post.creator._id.toString() !== req.userId.toString()) {
      const error = new Error("Not the creator");
      error.code = 404;
      throw error;
    }

    clearImage(post.imageUrl);

    await Post.findByIdAndRemove(id);
    const user = await User.findById(req.userId);
    user.posts.pull(id);
    await user.save();
    return true;
  },
  user: async function (args, req) {
    if (!req.isAuth) {
      const error = new Error("Not Authenticated User");
      error.code = 401;
      throw error;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("Cant find user");
      error.code = 404;
      throw error;
    }

    return { ...user._doc, _id: user._id.toString() };
  },
  updatedPost: async function ({ status }, req) {
    if (!req.isAuth) {
      const error = new Error("Not Authenticated User");
      error.code = 401;
      throw error;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      const error = new Error("Cant find user");
      error.code = 404;
      throw error;
    }

    user.status = status;
    await user.save();
    return {
      ...user._doc,
      _id: user._id.toString(),
    };
  },
};
