import { z } from "zod";

export const productionStages = [
  "identity-and-chronology",
  "source-discovery",
  "source-verification",
  "index-draft",
  "citation-location",
  "bias-and-counterevidence",
  "editorial-assembly",
];

export const coverageCandidateSchema = z.object({
  id: z.string().regex(/^candidate-\d{3}$/),
  name: z.string().min(1),
  englishName: z.string().min(1),
  primaryRegion: z.string().min(1),
  era: z.string().min(1),
  tradition: z.string().min(1),
  selectionReason: z.string().min(1),
  sourceAvailability: z.enum(["audit-required", "limited", "adequate"]),
  expectedTier: z.enum(["index", "standard", "deep"]),
  gapTags: z.array(z.string().min(1)).min(1),
  batch: z.number().int().min(1).max(7),
});

export const productionJobSchema = z.object({
  id: z.enum(productionStages),
  status: z.enum(["pending", "passed", "failed", "blocked"]),
  dependsOn: z.array(z.enum(productionStages)),
  attempts: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  lastResultId: z.string().min(1).nullable().default(null),
  lastError: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    retryable: z.boolean(),
  }).nullable(),
});

export const sourceLeadSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  authors: z.array(z.string().min(1)),
  sourceType: z.enum([
    "primary-text",
    "scholarly-book",
    "peer-reviewed-article",
    "scholarly-encyclopedia",
    "reference-dataset",
    "archival-source",
  ]),
  publication: z.string().min(1),
  year: z.number().int().nullable(),
  identifiers: z.object({
    url: z.string().url().nullable(),
    doi: z.string().min(1).nullable(),
    isbn: z.string().min(1).nullable(),
  }),
  verification: z.object({
    status: z.enum(["pending", "verified", "rejected"]),
    method: z.string().min(1).nullable(),
    checkedAt: z.string().datetime().nullable(),
    note: z.string().nullable(),
  }),
  relevance: z.string().min(1),
});

export const claimTaskSchema = z.object({
  id: z.string().min(1),
  claimType: z.enum(["identity", "chronology", "context", "thesis", "concept", "work", "place"]),
  prompt: z.string().min(1),
  status: z.enum(["pending", "supported", "rejected"]),
  claim: z.string().min(1).nullable(),
  sourceLeadId: z.string().min(1).nullable(),
  locator: z.string().min(1).nullable(),
});

const reviewCheckSchema = z.object({
  status: z.enum(["pending", "passed", "failed"]),
  questions: z.array(z.string().min(1)).min(1),
  notes: z.array(z.string()),
});

export const productionTaskSchema = z.object({
  schemaVersion: z.literal(1),
  workflowVersion: z.literal("index-candidate/v1"),
  batchId: z.string().regex(/^batch-\d{2}$/),
  candidateId: z.string().regex(/^candidate-\d{3}$/),
  proposedPersonId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  identity: z.object({
    displayName: z.string().min(1),
    englishName: z.string().min(1),
    originalName: z.string().min(1).nullable(),
    aliases: z.array(z.string().min(1)),
  }),
  coverage: z.object({
    primaryRegion: z.string().min(1),
    era: z.string().min(1),
    tradition: z.string().min(1),
    selectionReason: z.string().min(1),
    gapTags: z.array(z.string().min(1)).min(1),
  }),
  target: z.object({
    contentTier: z.enum(["index", "standard", "deep"]),
    editorialStatus: z.literal("candidate"),
    publicVisibility: z.literal(false),
  }),
  workflow: z.object({
    status: z.enum([
      "research-planned",
      "researching",
      "drafting",
      "evidence-review",
      "editorial-review",
      "ready-for-promotion",
      "blocked",
    ]),
    revision: z.number().int().positive(),
    jobs: z.array(productionJobSchema).length(productionStages.length),
  }),
  research: z.object({
    discoveryQueries: z.array(z.string().min(1)).min(3),
    sourceRequirements: z.object({
      minimumVerifiedSources: z.number().int().positive(),
      minimumIndependentScholarlySources: z.number().int().positive(),
      primaryTextPreferred: z.boolean(),
      referenceDatasetMayStandAlone: z.literal(false),
    }),
    sourceLeads: z.array(sourceLeadSchema),
    claimTasks: z.array(claimTaskSchema).min(6),
  }),
  draft: z.object({
    chronology: z.object({
      label: z.string().min(1),
      startYear: z.number().int(),
      endYear: z.number().int(),
      certainty: z.enum(["established", "approximate", "disputed"]),
      note: z.string().nullable(),
    }).nullable(),
    guidingQuestion: z.string().min(1).nullable(),
    thesis: z.string().min(1).nullable(),
    summary: z.string().min(80).max(180).nullable(),
    proposedConcepts: z.array(z.string().min(1)),
    proposedWorks: z.array(z.string().min(1)),
    proposedPlaces: z.array(z.string().min(1)),
  }),
  review: z.object({
    crossCulturalBias: reviewCheckSchema,
    counterEvidence: reviewCheckSchema,
    attributionAndUncertainty: reviewCheckSchema,
  }),
});

export const productionManifestSchema = z.object({
  schemaVersion: z.literal(1),
  workflowVersion: z.literal("index-candidate/v1"),
  batchId: z.string().regex(/^batch-\d{2}$/),
  batchNumber: z.number().int().min(1).max(7),
  status: z.literal("prepared"),
  candidateCount: z.literal(30),
  candidateIds: z.array(z.string().regex(/^candidate-\d{3}$/)).length(30),
  coverage: z.object({
    regionCounts: z.record(z.string(), z.number().int().positive()),
    eraCounts: z.record(z.string(), z.number().int().positive()),
    maximumSingleRegionShare: z.number().min(0).max(1),
  }),
  gates: z.object({
    minimumRegions: z.number().int().positive(),
    minimumEras: z.number().int().positive(),
    maximumSingleRegionShare: z.number().min(0).max(1),
    requireLocatorForEveryClaim: z.literal(true),
    automaticPublicationAllowed: z.literal(false),
  }),
  generatedBy: z.literal("content-batch-preparer/v1"),
});

export const workerResultSchema = z.object({
  schemaVersion: z.literal(1),
  resultId: z.string().min(1),
  batchId: z.string().regex(/^batch-\d{2}$/),
  candidateId: z.string().regex(/^candidate-\d{3}$/),
  stage: z.enum(productionStages),
  outcome: z.enum(["passed", "failed"]),
  worker: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).optional(),
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    retryable: z.boolean(),
  }).optional(),
}).superRefine((result, context) => {
  if (result.outcome === "failed" && !result.error) {
    context.addIssue({ code: "custom", path: ["error"], message: "failed results require error details" });
  }
  if (result.outcome === "passed" && result.error) {
    context.addIssue({ code: "custom", path: ["error"], message: "passed results cannot include an error" });
  }
});
