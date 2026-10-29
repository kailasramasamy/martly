import { GLOSSARY_LANGUAGES } from "@martly/shared/constants";

export const LANGUAGE_OPTIONS = Object.entries(GLOSSARY_LANGUAGES).map(([value, label]) => ({ value, label }));
