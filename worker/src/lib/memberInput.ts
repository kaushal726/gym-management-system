/* The details of a member that staff and the member themselves may edit (everything but the Gmail), with the
 * same rules for both: a real date of birth, and a guardian for anyone under 18. */
import { GENDERS, type Batch } from "../../../shared/constants.ts";
import { ageOn } from "../../../shared/dates.ts";
import { badInput } from "./http.ts";
import { mobile, optionalDate, optionalMobile, optionalOneOf, optionalText, text, type Body } from "./validate.ts";

const MAX_AGE_YEARS = 100;
const ADULT_AGE = 18;

/** `allowedBatches` are the gym's batches, plus the member's own when editing someone who already has one the gym no longer runs. */
export function readMemberDetails(body: Body, today: string, allowedBatches: readonly Batch[]) {
  const dob = optionalDate(body, "dob");
  if (dob && (dob > today || ageOn(dob, today) > MAX_AGE_YEARS)) throw badInput("dob");
  const guardianName = optionalText(body, "guardianName", { max: 80 });
  const guardianPhone = optionalMobile(body, "guardianPhone");
  if (dob && ageOn(dob, today) < ADULT_AGE && (!guardianName || !guardianPhone)) {
    throw badInput(guardianName ? "guardianPhone" : "guardianName", "A parent or guardian's name and number are needed for members under 18.");
  }
  return {
    name: text(body, "name", { max: 80 }),
    phone: mobile(body, "phone"),
    dob,
    gender: optionalOneOf(body, "gender", GENDERS),
    batch: optionalOneOf(body, "batch", allowedBatches),
    emergencyName: optionalText(body, "emergencyName", { max: 80 }),
    emergencyPhone: optionalMobile(body, "emergencyPhone"),
    guardianName,
    guardianPhone,
  };
}
