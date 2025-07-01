const express = require("express");
const app = express();
require("dotenv").config({
    path: ".env",
    silent: true
})
const connectDB = require('./db');
connectDB();
const jwt = require("jsonwebtoken");
const userModel = require("./models/user");
const postModel = require("./models/post");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const upload = require("./config/multerconfig")
const path = require("path");

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname,"public")));
app.use(cookieParser());

app.get("/", (req, res) => {
    res.render("index");
})

app.get("/profile/upload", (req, res) => {
    res.render("profileupload");
})

app.post("/upload", isLoggedIn, upload.single("image"), async (req, res) => {
    let user = await userModel.findOne({email: req.user.email});
    user.profilepic = req.file.filename;
    await user.save();
    res.redirect("/profile");
})

app.get("/login", (req, res) => {
    res.render("login");
})

app.get("/profile", isLoggedIn, async (req, res) => {
    let user = await userModel.findOne({email: req.user.email}).populate("posts");
    res.render("profile",{user});
})

app.get("/like/:id", isLoggedIn, async (req, res) => {
    let post = await postModel.findOne({_id: req.params.id}).populate("user");
    let user = await userModel.findOne({email:req.user.email}).populate("posts");

    if(post.likes.indexOf(user._id) === -1){
        post.likes.push(user._id);
    }
    else{
        post.likes.splice(post.likes.indexOf(user._id), 1);
    }
    await post.save();
    res.redirect("/profile");
})

app.get("/edit/:id", isLoggedIn, async (req, res) => {
    let post = await postModel.findOne({_id: req.params.id}).populate("user");
    let user = await userModel.findOne({email: req.user.email}).populate("posts");

    res.render("edit", {user, post});
})

app.post("/update/:id", isLoggedIn, async (req, res) => {
    let post = await postModel.findOneAndUpdate({_id: req.params.id},{content: req.body.content});
    res.redirect("/profile");
})

app.post("/post", isLoggedIn, async (req, res) => {
    let user = await userModel.findOne({email: req.user.email});
    let {content} = req.body;

    let post = await postModel.create({
        user: user._id,
        content
    })

    user.posts.push(post._id);
    await user.save();
    res.redirect("/profile");
})

app.post("/register", async (req, res) => {
    let {username, name, email, password, age} = req.body;

    let user = await userModel.findOne({email});
    if(user) return res.status(400).send("User is Alerady Registerd");

    bcrypt.genSalt(10, (err, salt) =>{
        bcrypt.hash(password, salt, async (err, hash) => {
            let user = await userModel.create({
                username,
                name,
                email,
                password: hash,
                age
            })

            let token = jwt.sign({email: email, userid: user._id}, "secret");
            res.cookie("token", token);
            res.redirect("/profile");
        })
    })
})

app.post("/login", async (req, res) => {
    let {email, password} = req.body;

    let user = await userModel.findOne({email});
    if(!user) return res.status(400).send("Email or Password is Invalid");

    bcrypt.compare(password, user.password, (err, result) => {
        if(result){
            let token = jwt.sign({email: user.email}, "secret");
            res.cookie("token", token);
            res.redirect("/profile");
        }
        else res.send("Email or Password is Invalid");
    })
})

app.get("/logout", (req, res) => {
    res.cookie("token", "");
    res.redirect("/login");
})

function isLoggedIn(req, res, next){
    if(req.cookies.token === "") res.redirect("/login");
    else{
        let data = jwt.verify(req.cookies.token, "secret")
        req.user = data;
        next();
    }
}

app.listen(3000, () => {
  console.log("Server running on port 3000");
});