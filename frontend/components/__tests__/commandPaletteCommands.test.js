import { buildCommands } from "../commandPaletteCommands";

describe("commandPaletteCommands", () => {
  const mockRouter = { push: jest.fn() };
  const mockSetTheme = jest.fn();
  const mockOnClose = jest.fn();

  function getCommands(theme = "light") {
    return buildCommands({
      router: mockRouter,
      theme,
      setTheme: mockSetTheme,
      onClose: mockOnClose,
    });
  }

  it("returns an array of command objects", () => {
    const commands = getCommands();
    expect(Array.isArray(commands)).toBe(true);
    expect(commands.length).toBeGreaterThan(0);
  });

  it("every command has required fields: id, group, title, icon, action, keywords", () => {
    const commands = getCommands();
    for (const cmd of commands) {
      expect(cmd).toHaveProperty("id");
      expect(cmd).toHaveProperty("group");
      expect(cmd).toHaveProperty("title");
      expect(cmd).toHaveProperty("icon");
      expect(typeof cmd.action).toBe("function");
      expect(Array.isArray(cmd.keywords)).toBe(true);
    }
  });

  it("navigation commands call router.push with correct paths", () => {
    const commands = getCommands();
    const navHome = commands.find((c) => c.id === "nav-home");
    navHome.action();
    expect(mockRouter.push).toHaveBeenCalledWith("/");

    const navCases = commands.find((c) => c.id === "nav-case-index");
    navCases.action();
    expect(mockRouter.push).toHaveBeenCalledWith("/validation-cases");
  });

  it("theme commands call setTheme with correct value", () => {
    const commands = getCommands("light");
    const darkCmd = commands.find((c) => c.id === "action-theme-dark");
    darkCmd.action();
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("hides theme command matching current theme", () => {
    const commandsLight = getCommands("light");
    expect(commandsLight.find((c) => c.id === "action-theme-light").hidden).toBe(true);
    expect(commandsLight.find((c) => c.id === "action-theme-dark").hidden).toBe(false);

    const commandsDark = getCommands("dark");
    expect(commandsDark.find((c) => c.id === "action-theme-dark").hidden).toBe(true);
    expect(commandsDark.find((c) => c.id === "action-theme-light").hidden).toBe(false);
  });

  it("all command ids are unique", () => {
    const commands = getCommands();
    const ids = commands.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
