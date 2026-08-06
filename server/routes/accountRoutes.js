import { Router } from "express";
import {
  postChangeName,
  postChangePassword,
  postCloseAccount,
  postConfirmEmailChange,
  postRequestEmailChange,
} from "../controllers/accountController.js";
import { requireSession } from "../middleware/requireSession.js";
import { accountMutationRateLimit, passwordResetRateLimit } from "../middleware/rateLimit.js";

const router = Router();

router.post("/account/change-password", requireSession, accountMutationRateLimit, postChangePassword);
router.post("/account/change-email/request", requireSession, accountMutationRateLimit, postRequestEmailChange);
// Not behind requireSession - the token itself is the credential, same as
// POST /reset-password. Rate-limited by IP (passwordResetRateLimit) rather
// than by account, matching that same unauthenticated-confirm precedent.
router.post("/account/change-email/confirm", passwordResetRateLimit, postConfirmEmailChange);
router.post("/account/change-name", requireSession, accountMutationRateLimit, postChangeName);
router.post("/account/close", requireSession, accountMutationRateLimit, postCloseAccount);

export default router;
