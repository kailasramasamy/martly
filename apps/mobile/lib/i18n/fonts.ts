import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";

const MANROPE = [Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold];
// Manrope has no Tamil glyphs; Noto Sans Tamil carries Tamil and Latin in every weight, so bold stays bold. These are
// Noto Sans Tamil with Manrope's digits, sized so numbers match English (scripts/build-tamil-fonts.py)
const MARTLY_TAMIL = [
  require("../../assets/fonts/MartlyTamil-Regular.ttf"),
  require("../../assets/fonts/MartlyTamil-Medium.ttf"),
  require("../../assets/fonts/MartlyTamil-SemiBold.ttf"),
  require("../../assets/fonts/MartlyTamil-Bold.ttf"),
  require("../../assets/fonts/MartlyTamil-ExtraBold.ttf"),
];

export const usesTamilFont = (lang: string | null) => lang === "ta";

/** Font files behind the App-* family names that font-patch and the theme use; picked once at launch */
export function appFonts(lang: string | null) {
  const [regular, medium, semibold, bold, extrabold] = usesTamilFont(lang) ? MARTLY_TAMIL : MANROPE;
  return {
    "App-Regular": regular,
    "App-Medium": medium,
    "App-SemiBold": semibold,
    "App-Bold": bold,
    "App-ExtraBold": extrabold,
  };
}
