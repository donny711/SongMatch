let _getUid: () => string | null = () => null;
let _grantMilestone: (id: string) => void = () => {};

export function registerProfileRef(
  getUid: () => string | null,
  grantMilestone: (id: string) => void,
) {
  _getUid = getUid;
  _grantMilestone = grantMilestone;
}

export const profileRef = {
  getUid: () => _getUid(),
  grantMilestone: (id: string) => _grantMilestone(id),
};
