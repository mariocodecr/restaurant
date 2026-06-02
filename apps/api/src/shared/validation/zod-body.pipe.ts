import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from "@nestjs/common";
import type { ZodSchema, ZodIssue } from "zod";

@Injectable()
export class ZodBodyPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown, metadata: ArgumentMetadata): T {
    if (metadata.type !== "body") return value as T;

    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        error: "ValidationError",
        issues: result.error.issues.map((issue: ZodIssue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}
