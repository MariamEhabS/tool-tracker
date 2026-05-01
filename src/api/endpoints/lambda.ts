import { logger } from "@/utils/logger";
import { logDocumentError } from "@/utils/rollbar";

export const extractEquipmentCodes = async (s3PresignedUrls: string[]) => {
  try {
    return await fetch(
      "https://sqnbh4ludumiculoobxjbkh3mq0xttow.lambda-url.us-east-1.on.aws",
      {
        method: "POST",
        body: JSON.stringify({
          s3_signed_urls: [s3PresignedUrls],
          use_llm: "False",
        }),
      },
    ).then((res) => res.json());
  } catch (error) {
    logDocumentError(error, "lambda-extraction-failed");
    logger.error("Lambda extraction error:", error);
    throw error;
  }
};
