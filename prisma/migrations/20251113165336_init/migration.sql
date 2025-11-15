-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Complexity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "FeatureStatus" AS ENUM ('PENDING', 'PLANNING', 'IMPLEMENTING', 'PR_OPEN', 'IN_REVIEW', 'APPROVED', 'MERGED', 'FAILED');

-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('CODER', 'REVIEWER', 'REPO_MANAGER');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('START_PROJECT', 'PR_CREATED', 'REVIEW_COMMENTS_POSTED', 'REVIEW_APPROVED', 'COMMITS_PUSHED', 'PR_MERGED', 'CONTINUE_NEXT_FEATURE', 'ALL_FEATURES_COMPLETE', 'ERROR_OCCURRED', 'AGENT_HEARTBEAT');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('COMMENT', 'REQUEST_CHANGES', 'APPROVE');

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "requirements" TEXT NOT NULL,
    "repository" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "features" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "complexity" "Complexity" NOT NULL,
    "priority" INTEGER NOT NULL,
    "dependencies" TEXT[],
    "status" "FeatureStatus" NOT NULL DEFAULT 'PENDING',
    "prNumber" INTEGER,
    "prUrl" TEXT,
    "branch" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "estimatedDuration" INTEGER,
    "actualDuration" INTEGER,

    CONSTRAINT "features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_states" (
    "id" TEXT NOT NULL,
    "agentType" "AgentType" NOT NULL,
    "state" TEXT NOT NULL,
    "jobId" TEXT,
    "featureId" TEXT,
    "context" JSONB NOT NULL DEFAULT '{}',
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "from" "AgentType" NOT NULL,
    "to" "AgentType" NOT NULL,
    "type" "MessageType" NOT NULL,
    "payload" JSONB NOT NULL,
    "correlationId" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "githubReviewId" INTEGER,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "comments" JSONB NOT NULL DEFAULT '[]',
    "decision" "ReviewDecision" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_interactions" (
    "id" TEXT NOT NULL,
    "agentType" "AgentType" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "durationMs" INTEGER,
    "cost" DOUBLE PRECISION,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_events" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "repository" TEXT NOT NULL,
    "prNumber" INTEGER,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "github_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_createdAt_idx" ON "jobs"("createdAt");

-- CreateIndex
CREATE INDEX "features_jobId_status_idx" ON "features"("jobId", "status");

-- CreateIndex
CREATE INDEX "features_status_idx" ON "features"("status");

-- CreateIndex
CREATE INDEX "agent_states_agentType_idx" ON "agent_states"("agentType");

-- CreateIndex
CREATE INDEX "agent_states_lastActivity_idx" ON "agent_states"("lastActivity");

-- CreateIndex
CREATE INDEX "messages_to_processed_idx" ON "messages"("to", "processed");

-- CreateIndex
CREATE INDEX "messages_correlationId_idx" ON "messages"("correlationId");

-- CreateIndex
CREATE INDEX "messages_timestamp_idx" ON "messages"("timestamp");

-- CreateIndex
CREATE INDEX "reviews_featureId_idx" ON "reviews"("featureId");

-- CreateIndex
CREATE INDEX "reviews_status_idx" ON "reviews"("status");

-- CreateIndex
CREATE INDEX "llm_interactions_agentType_idx" ON "llm_interactions"("agentType");

-- CreateIndex
CREATE INDEX "llm_interactions_provider_idx" ON "llm_interactions"("provider");

-- CreateIndex
CREATE INDEX "llm_interactions_createdAt_idx" ON "llm_interactions"("createdAt");

-- CreateIndex
CREATE INDEX "github_events_eventType_idx" ON "github_events"("eventType");

-- CreateIndex
CREATE INDEX "github_events_repository_idx" ON "github_events"("repository");

-- CreateIndex
CREATE INDEX "github_events_createdAt_idx" ON "github_events"("createdAt");

-- AddForeignKey
ALTER TABLE "features" ADD CONSTRAINT "features_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "features"("id") ON DELETE CASCADE ON UPDATE CASCADE;
