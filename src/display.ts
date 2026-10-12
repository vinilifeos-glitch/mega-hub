/** How other people appear in shared views: @username. Full names stay in own Profile and owner Accounts. */
export const displayName = (u: { username: string }) => `@${u.username}`;
