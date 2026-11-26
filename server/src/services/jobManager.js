import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { execSync } from "node:child_process";

export class JobCancelledError extends Error {
  constructor(message = "Generation was cancelled") {
    super(message);
    this.name = "JobCancelledError";
    this.isCancelled = true;
  }
}

class JobManager {
  constructor() {
    /**
     * @type {Map<string, {
     *   jobId: string,
     *   projectId: string,
     *   userId: string,
     *   type: string,
     *   status: string,
     *   abortController: AbortController,
     *   activeProcesses: Set<any>,
     *   tempDirs: Set<string>,
     *   tempFiles: Set<string>,
     *   startTime: number
     * }>}
     */
    this.activeJobs = new Map();
    /** @type {Set<string>} */
    this.cancelledJobIds = new Set();
    /** @type {Map<string, number>} */
    this.cancelledProjectIds = new Map();
  }

  /**
   * Starts tracking a new generation job.
   */
  startJob({ projectId, userId, type = "pipeline" }) {
    const pId = String(projectId);
    if (this.activeJobs.has(pId)) {
      throw Object.assign(new Error('A generation job is already running for this project'), { status: 409 });
    }
    this.cancelledProjectIds.delete(pId);

    const job = {
      jobId: `job-${randomUUID()}`,
      projectId: pId,
      userId: userId ? String(userId) : "",
      type,
      status: "running",
      abortController: new AbortController(),
      activeProcesses: new Set(),
      tempDirs: new Set(),
      tempFiles: new Set(),
      startTime: Date.now(),
    };

    this.activeJobs.set(pId, job);
    return job;
  }

  /**
   * Retrieves active job by project ID.
   */
  getJob(projectId) {
    if (!projectId) return null;
    return this.activeJobs.get(String(projectId));
  }

  /**
   * Returns true if job is cancelled or no longer running.
   */
  isCancelled(projectId, jobId) {
    if (!projectId) return false;
    const pId = String(projectId);
    if (jobId && this.cancelledJobIds.has(jobId)) return true;
    if (this.cancelledProjectIds.has(pId)) return true;
    const job = this.activeJobs.get(pId);
    if (!job) return false;
    if (jobId && job.jobId !== jobId) return true;
    return job.status === "cancelled" || job.abortController.signal.aborted;
  }

  /**
   * Throws JobCancelledError if the job has been cancelled.
   */
  checkCancelled(projectId, jobId) {
    if (this.isCancelled(projectId, jobId)) {
      throw new JobCancelledError();
    }
  }

  /**
   * Registers a running command or process to be terminated if cancelled.
   */
  registerProcess(projectId, proc) {
    if (!projectId || !proc) return () => {};
    const job = this.activeJobs.get(String(projectId));
    if (!job) return () => {};
    job.activeProcesses.add(proc);
    return () => {
      job.activeProcesses.delete(proc);
    };
  }

  /**
   * Registers a temporary directory to be removed on cancellation.
   */
  registerTempDir(projectId, dirPath) {
    if (!projectId || !dirPath) return;
    const job = this.activeJobs.get(String(projectId));
    if (job) {
      job.tempDirs.add(dirPath);
    }
  }

  /**
   * Registers a temporary file to be removed on cancellation.
   */
  registerTempFile(projectId, filePath) {
    if (!projectId || !filePath) return;
    const job = this.activeJobs.get(String(projectId));
    if (job) {
      job.tempFiles.add(filePath);
    }
  }

  /**
   * Cancels a running job, safely aborts network requests, kills FFmpeg processes, and cleans temp files.
   */
  cancelJob(projectId, userId) {
    if (!projectId) return false;
    const pId = String(projectId);
    const job = this.activeJobs.get(pId);
    if (!job) return false;

    if (userId && job.userId && String(job.userId) !== String(userId)) {
      const err = new Error("Not authorized to cancel this generation job");
      err.status = 403;
      throw err;
    }

    job.status = "cancelled";
    this.cancelledJobIds.add(job.jobId);
    this.cancelledProjectIds.set(pId, Date.now());

    try {
      job.abortController.abort();
    } catch (e) {
      // ignore
    }

    // Safely terminate active FFmpeg processes and child processes
    for (const proc of job.activeProcesses) {
      try {
        if (typeof proc.kill === "function") {
          proc.kill("SIGKILL");
        }
        const pid = proc.ffmpegProc?.pid || proc.pid;
        if (pid && process.platform === "win32") {
          try {
            execSync(`taskkill /pid ${pid} /T /F`, { stdio: "ignore" });
          } catch (e) {
            // Process may already have exited
          }
        }
      } catch (e) {
        // ignore
      }
    }
    job.activeProcesses.clear();

    // Clean up temporary directories
    for (const dir of job.tempDirs) {
      try {
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      } catch (e) {
        // ignore
      }
    }
    job.tempDirs.clear();

    // Clean up temporary files
    for (const file of job.tempFiles) {
      try {
        if (fs.existsSync(file)) {
          fs.rmSync(file, { force: true });
        }
      } catch (e) {
        // ignore
      }
    }
    job.tempFiles.clear();

    this.activeJobs.delete(pId);
    return true;
  }

  /**
   * Finishes a job when pipeline completes normally or encounters an unhandled error.
   */
  finishJob(projectId, jobId) {
    if (!projectId) return;
    const pId = String(projectId);
    const job = this.activeJobs.get(pId);
    if (job && (!jobId || job.jobId === jobId)) {
      this.activeJobs.delete(pId);
    }
  }
}

export const jobManager = new JobManager();
