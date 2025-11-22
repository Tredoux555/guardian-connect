# Cursor Mode Recommendations

## When to Use Composer1 (Uses Credits)

Use Composer1 for:
- **Complex refactoring** across multiple files
- **Large codebase changes** requiring deep understanding
- **Advanced debugging** of complex issues
- **Multi-file coordination** with interdependent changes
- **Architecture-level changes** requiring careful planning
- **Complex algorithms** or data structure implementations
- **Performance optimizations** requiring deep analysis

## When to Use Auto (Free/Standard)

Use Auto for:
- **Simple bug fixes** (like timing issues, condition checks)
- **Single file edits** with straightforward changes
- **Build verification** and testing
- **Standard CRUD operations**
- **Configuration updates**
- **Simple feature additions** following existing patterns
- **Code cleanup** and formatting
- **Documentation updates**

## Build Integrity

**Important**: Build integrity depends on **agent mode** (ability to run builds), not the specific model.

Both Composer1 and Auto can:
- ✅ Run `npm run build` to catch TypeScript errors
- ✅ Verify compilation succeeds
- ✅ Test logic correctness
- ✅ Commit and push changes

## Current Recommendation

For most tasks in this project, **Auto in agent mode** is sufficient and cost-effective.

Only use Composer1 when:
- The task is complex enough to benefit from advanced reasoning
- You're doing major refactoring
- Auto struggles with the complexity

## Example: Google Maps Fixes

**Task**: Fix Google Maps loading timing and location permission
- **Complexity**: Low-Medium (simple timing fix + condition check)
- **Recommendation**: ✅ **Auto** - Simple enough, saves credits
- **Result**: Same build integrity, faster, cheaper

