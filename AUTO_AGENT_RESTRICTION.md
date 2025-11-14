# ⚠️ AUTO AGENT RESTRICTION

## IMPORTANT: Code Modification Policy

**NEVER allow Auto Agent to touch/modify code in this application.**

### Policy:
- ✅ **Composer ONLY** - Only Composer mode is allowed to modify code
- ❌ **Auto Agent** - Auto Agent should ONLY answer questions, NEVER modify code
- 🔒 **Enforcement** - This restriction must be enforced at all times

### Reason:
Every time Auto Agent has touched the code, it has caused issues that needed to be fixed. Examples:
- React Hooks violations (hooks called conditionally or in wrong order)
- Breaking changes that require immediate fixes
- Code quality issues

### What Auto Agent CAN do:
- Answer questions about the codebase
- Provide explanations
- Read and analyze code
- Suggest fixes (but NOT implement them)

### What Auto Agent CANNOT do:
- Modify any files
- Run terminal commands that change code
- Apply fixes directly
- Make any code changes whatsoever

### Implementation:
When Auto Agent attempts to modify code, it should:
1. Recognize it's in Auto Agent mode
2. Inform the user that code changes require Composer mode
3. Provide suggestions or explanations instead
4. Wait for user to switch to Composer mode for actual implementation

---

**Last Updated:** 2025-01-14
**Status:** ACTIVE - Must be enforced

