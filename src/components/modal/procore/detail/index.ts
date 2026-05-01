import type { ComponentType } from "react";
import type { ContentProps } from "./types";

import CoordinationIssueContent from "./CoordinationIssueContent";
import DocumentContent from "./DocumentContent";
import DrawingContent from "./DrawingContent";
import FormContent from "./FormContent";
import IncidentContent from "./IncidentContent";
import InspectionContent from "./InspectionContent";
import InstructionContent from "./InstructionContent";
import ObservationContent from "./ObservationContent";
import PhotoContent from "./PhotoContent";
import PunchListContent from "./PunchListContent";
import RfiContent from "./RfiContent";
import SubmittalContent from "./SubmittalContent";
import SpecificationContent from "./SpecificationContent";
import TaskContent from "./TaskContent";
import DirectoryContent from "./DirectoryContent";

export const contentRegistry: Record<
  string,
  ComponentType<ContentProps>
> = {
  "coordination-issue": CoordinationIssueContent,
  document: DocumentContent,
  drawing: DrawingContent,
  form: FormContent,
  incident: IncidentContent,
  inspection: InspectionContent,
  instruction: InstructionContent,
  observation: ObservationContent,
  photo: PhotoContent,
  "punch-list": PunchListContent,
  rfi: RfiContent,
  submittal: SubmittalContent,
  specification: SpecificationContent,
  task: TaskContent,
  directory: DirectoryContent,
};
