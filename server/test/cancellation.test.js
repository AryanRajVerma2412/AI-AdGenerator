import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import jwt from "jsonwebtoken";
import { jobManager, JobCancelledError } from "../src/services/jobManager.js";
import Project from "../src/models/Project.js";
import projectsRouter from "../src/routes/projects.js";

test("jobManager tracks and cancels active jobs with resources", () => {
  const projectId = "test-proj-123";
  const userId = "user-123";
  const job = jobManager.startJob({ projectId, userId });

  assert.equal(job.projectId, projectId);
  assert.equal(job.status, "running");
  assert.equal(jobManager.isCancelled(projectId, job.jobId), false);

  // Register dummy process
  let killed = false;
  const dummyProc = {
    kill: (sig) => { killed = true; }
  };
  jobManager.registerProcess(projectId, dummyProc);

  // Register dummy temp dir & file
  const tempDir = path.resolve("uploads", `test-temp-dir-${Date.now()}`);
  const tempFile = path.resolve("uploads", `test-temp-file-${Date.now()}.txt`);
  fs.mkdirSync(tempDir, { recursive: true });
  fs.writeFileSync(tempFile, "hello");

  jobManager.registerTempDir(projectId, tempDir);
  jobManager.registerTempFile(projectId, tempFile);

  // Cancel job
  const res = jobManager.cancelJob(projectId, userId);
  assert.equal(res, true);
  assert.equal(killed, true);
  assert.equal(job.abortController.signal.aborted, true);
  assert.equal(fs.existsSync(tempDir), false);
  assert.equal(fs.existsSync(tempFile), false);
  assert.throws(() => jobManager.checkCancelled(projectId, job.jobId), JobCancelledError);
});

test("cancel endpoint verifies ownership and handles project states", async () => {
  const originalFindOne = Project.findOne;
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-cancellation-secret";

  const app = express();
  app.use(express.json());
  app.use("/api/projects", projectsRouter);

  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/projects`;
  const ownerToken = jwt.sign({ id: "user-owner" }, process.env.JWT_SECRET);
  const otherToken = jwt.sign({ id: "user-attacker" }, process.env.JWT_SECRET);

  try {
    // 1. Not authorized user attempting to cancel (404 / not found for that user)
    Project.findOne = async (query) => {
      if (query._id === "proj-1" && query.userId === "user-owner") {
        return {
          _id: "proj-1",
          userId: "user-owner",
          status: "processing",
          save: async () => {},
        };
      }
      return null;
    };

    const resOther = await fetch(`${baseUrl}/proj-1/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    assert.equal(resOther.status, 404);

    // 2. Owner cancelling a processing project -> 200 and status cancelled
    let savedStatus = "";
    Project.findOne = async (query) => {
      if (query._id === "proj-1" && query.userId === "user-owner") {
        return {
          _id: "proj-1",
          userId: "user-owner",
          status: "processing",
          save: async function () { savedStatus = this.status; },
        };
      }
      return null;
    };

    const resOwner = await fetch(`${baseUrl}/proj-1/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(resOwner.status, 200);
    const dataOwner = await resOwner.json();
    assert.equal(dataOwner.status, "cancelled");
    assert.equal(savedStatus, "cancelled");

    // 3. Cancelling an already completed project -> 400
    Project.findOne = async (query) => {
      if (query._id === "proj-1" && query.userId === "user-owner") {
        return {
          _id: "proj-1",
          userId: "user-owner",
          status: "completed",
          save: async () => {},
        };
      }
      return null;
    };

    const resCompleted = await fetch(`${baseUrl}/proj-1/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(resCompleted.status, 400);

    // 4. Duplicate cancellation -> returns 200 already cancelled
    Project.findOne = async (query) => {
      if (query._id === "proj-1" && query.userId === "user-owner") {
        return {
          _id: "proj-1",
          userId: "user-owner",
          status: "cancelled",
          save: async () => {},
        };
      }
      return null;
    };

    const resDuplicate = await fetch(`${baseUrl}/proj-1/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.equal(resDuplicate.status, 200);
    const dataDup = await resDuplicate.json();
    assert.match(dataDup.message, /already cancelled/i);

  } finally {
    await new Promise(resolve => server.close(resolve));
    Project.findOne = originalFindOne;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});

test("runPipeline terminates cleanly when job is cancelled before completion", async () => {
  const { runPipeline } = await import("../src/services/pipeline.js");
  const testId = "proj-pipeline-cancel";
  const originalFindById = Project.findById;

  let currentStatus = "processing";
  let finalVideoAssigned = false;

  const mockProject = {
    _id: testId,
    productName: "Test Drone",
    description: "High performance camera drone",
    category: "Electronics & Gadgets",
    audience: "Creators",
    tone: "Professional",
    duration: 15,
    style: "Modern",
    ctaText: "Buy now",
    aspectRatio: "9:16",
    productImageUrl: "/uploads/nonexistent.png",
    voiceSettings: { language: "en" },
    script: [],
    warnings: [],
    status: "processing",
    generationStage: "Queued",
    save: async function() {
      currentStatus = this.status;
      if (this.finalVideoUrl) finalVideoAssigned = true;
      if (this.generationStage === 'Writing advertisement script') jobManager.cancelJob(testId, 'user-owner');
    }
  };

  Project.findById = async (id) => (id === testId ? mockProject : null);

  try {
    // Start pipeline
    const pipelinePromise = runPipeline(testId, "user-owner");

    // Wait a tick for pipeline to start, then cancel
    await new Promise(r => setTimeout(r, 15));
    jobManager.cancelJob(testId, "user-owner");

    // Await pipeline completion
    await pipelinePromise;

    // Must NOT have completed or assigned finalVideoUrl
    assert.equal(finalVideoAssigned, false);
    // Must NOT have marked status as failed
    assert.notEqual(currentStatus, "failed");
  } finally {
    Project.findById = originalFindById;
  }
});

