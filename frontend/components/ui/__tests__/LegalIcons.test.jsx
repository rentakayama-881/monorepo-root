import { render } from "@testing-library/react";
import {
  CheckIcon,
  ShieldIcon,
  LockIcon,
  UserIcon,
  DatabaseIcon,
  GlobeIcon,
  CookieIcon,
  DocumentIcon,
  MailIcon,
} from "../LegalIcons";

describe("LegalIcons", () => {
  it.each([
    ["CheckIcon", CheckIcon],
    ["ShieldIcon", ShieldIcon],
    ["LockIcon", LockIcon],
    ["UserIcon", UserIcon],
    ["DatabaseIcon", DatabaseIcon],
    ["GlobeIcon", GlobeIcon],
    ["CookieIcon", CookieIcon],
    ["DocumentIcon", DocumentIcon],
    ["MailIcon", MailIcon],
  ])("%s renders without crashing", (_name, IconComponent) => {
    const { container } = render(<IconComponent />);
    expect(container.firstChild).toBeTruthy();
  });
});
