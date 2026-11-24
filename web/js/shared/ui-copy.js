// Only call for app-owned labels. Names, messages and saved card content are
// intentionally rendered verbatim and must never pass through this formatter.
export const uiSeparators = value => value.replace(/[·•●∙⋅]/gu, '-');
