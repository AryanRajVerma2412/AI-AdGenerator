import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import express from "express";
import jwt from "jsonwebtoken";
import Project from "../src/models/Project.js";
import projects from "../src/routes/projects.js";

test("video download requires ownership and returns an MP4 attachment", async () => {
  const original = Project.findOne;
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-only-download-secret";
  const filename = `download-test-${randomUUID()}.mp4`;
  const file = path.resolve("uploads", filename);
  fs.writeFileSync(file, "test-video-bytes");
  Project.findOne = async query => query.userId === "owner" ? {
    _id: "project", status: "completed", finalVideoUrl: `/uploads/${filename}`,
  } : null;
  const app = express(); app.use("/api/projects", projects);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/projects/project/download`;
  try {
    assert.equal((await fetch(url)).status, 401);
    const other = jwt.sign({ id: "other" }, process.env.JWT_SECRET);
    assert.equal((await fetch(url, { headers: { Authorization: `Bearer ${other}` } })).status, 404);
    const token = jwt.sign({ id: "owner" }, process.env.JWT_SECRET);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-disposition"), /attachment.*advertisement-project.mp4/);
    assert.match(response.headers.get("content-type"), /video\/mp4/);
    assert.equal(await response.text(), "test-video-bytes");
  } finally {
    await new Promise(resolve => server.close(resolve));
    Project.findOne = original;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
    fs.unlinkSync(file);
  }
});
