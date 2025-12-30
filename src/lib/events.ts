import { type EventSchemas } from "inngest";
import { EnrichedItem, ConsumableData } from "../types/domain";

export type ResearchStartedEvent = {
    name: "app/research.started";
    data: {
        jobId: string;
        inputRaw: string;
        userId?: string;
    };
};

export type ResearchStepEvent = {
    name: "app/research.step";
    data: {
        jobId: string;
        step: 'planning' | 'search' | 'extraction' | 'verification';
        message: string;
    };
};

export type ResearchCompletedEvent = {
    name: "app/research.completed";
    data: {
        jobId: string;
        result: ConsumableData;
    };
};

export type Events = {
    "app/research.started": ResearchStartedEvent;
    "app/research.step": ResearchStepEvent;
    "app/research.completed": ResearchCompletedEvent;
};

// Validated Schema for Inngest
export const eventSchemas = {} as EventSchemas<Events>;
