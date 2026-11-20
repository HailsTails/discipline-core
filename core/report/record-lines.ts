import type { z } from "zod";
import type { CarriedListing, CatalogueNote, HoneRecord, OutsideParty, RecordPlace, RecordRefusal, RefusedRecord } from "../records/hone-record.ts";
import { onOneLine, quoted } from "./printed-text.ts";

const WHOLE_RECORD = "record";

export const recordPlaceText = (request: { readonly place: RecordPlace }): string => `${request.place.file} records[${request.place.index}]`;

export const outsidePartyText = (request: { readonly party: OutsideParty }): string => {
  switch (request.party.kind) {
    case "package":
    case "scheme-module":
      return request.party.specifier;
    case "runtime":
      return `runtime:${request.party.facility}`;
  }
};

const catalogueNoteText = (request: { readonly note: CatalogueNote }): string => {
  switch (request.note.kind) {
    case "unknown-case":
      return ` note: the catalogue has no case ${quoted({ text: request.note.case })}, owing ${quoted({ text: request.note.owes })}`;
    case "owes-not-owed":
      return ` note: ${request.note.case.name} does not owe ${quoted({ text: request.note.owes })}`;
  }
};

const heldText = (request: { readonly record: HoneRecord }): string => {
  const { record } = request;
  switch (record.kind) {
    case "debt":
    case "boundary-record":
      return record.holding.held === "carried" ? " carried" : "";
    case "authorised-location":
      if (record.holding.held === "carried") {
        return " carried";
      }
      return record.holding.owing.matches === "not-the-catalogue" ? catalogueNoteText({ note: record.holding.owing.note }) : "";
    case "deviation":
    case "dependency-record":
      return "";
  }
};

const subjectOf = (request: { readonly record: HoneRecord }): string => {
  const { record } = request;
  switch (record.kind) {
    case "debt":
    case "authorised-location":
      return `${record.symptom.name} ${record.kind} ${record.file}`;
    case "deviation":
      return `${record.recipe.name} ${record.kind} ${record.file}`;
    case "boundary-record":
      return `${outsidePartyText({ party: record.outsideParty })} ${record.kind} ${record.module}`;
    case "dependency-record":
      return `${record.dependency} ${record.kind}`;
  }
};

const referenceOf = (request: { readonly record: HoneRecord }): string => {
  const { record } = request;
  switch (record.kind) {
    case "debt":
    case "authorised-location":
      return record.kind;
    case "deviation":
      return `${record.kind} ${record.recipe.name}`;
    case "boundary-record":
      return `${record.kind} ${outsidePartyText({ party: record.outsideParty })}`;
    case "dependency-record":
      return `${record.kind} ${record.dependency}`;
  }
};

export const recordSubjectText = (request: { readonly record: HoneRecord }): string => `${subjectOf(request)}${heldText(request)}`;

export const recordReferenceText = (request: { readonly record: HoneRecord }): string => `${referenceOf(request)}${heldText(request)}`;

const issueText = (request: { readonly issue: z.core.$ZodIssue }): string => {
  const path = request.issue.path.length === 0 ? WHOLE_RECORD : request.issue.path.join(".");
  return `${path}: ${request.issue.message}`;
};

const refusalDetail = (request: { readonly refusal: RecordRefusal }): string => {
  const { refusal } = request;
  switch (refusal.kind) {
    case "form-refused":
      return ` ${onOneLine({ text: refusal.issues.map((issue) => issueText({ issue })).join("; ") })}`;
    case "unknown-symptom":
      return ` ${quoted({ text: refusal.symptom })}`;
    case "unknown-recipe":
      return ` ${quoted({ text: refusal.recipe })}`;
    case "recipe-reason-not-the-catalogues":
      return ` ${refusal.recipe.name}: the catalogue gives its reason as ${quoted({ text: refusal.recipe.reason.text })}`;
    case "named-ban":
      return ` ${refusal.dependency}`;
    case "unknown-runtime-facility":
      return ` ${refusal.outsideParty}`;
    case "misplaced":
      return ` ${refusal.belongsIn}`;
    case "not-a-records-name":
      return ` ${quoted({ text: refusal.name })}`;
    case "carried-changed-since-base":
      return "";
    case "duplicate":
      return ` of ${recordPlaceText({ place: refusal.of })}`;
  }
};

export const refusedLines = (request: { readonly refused: RefusedRecord }): readonly string[] =>
  request.refused.refusals.map((refusal) => `${recordPlaceText(request.refused)} ${refusal.kind}${refusalDetail({ refusal })}`);

export const carriedLine = (request: { readonly listing: CarriedListing }): string => {
  const lacks = request.listing.lacks.length === 0 ? "" : ` lacks ${request.listing.lacks.join(", ")}`;
  return `${recordPlaceText(request.listing)} ${request.listing.standing}${lacks}`;
};
