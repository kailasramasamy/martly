import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import {
  NotoSansTamil_400Regular,
  NotoSansTamil_500Medium,
  NotoSansTamil_600SemiBold,
  NotoSansTamil_700Bold,
  NotoSansTamil_800ExtraBold,
} from "@expo-google-fonts/noto-sans-tamil";

const MANROPE = [Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold];
// Manrope has no Tamil glyphs; Noto Sans Tamil carries Tamil and Latin in every weight, so bold stays bold
const NOTO_SANS_TAMIL = [NotoSansTamil_400Regular, NotoSansTamil_500Medium, NotoSansTamil_600SemiBold, NotoSansTamil_700Bold, NotoSansTamil_800ExtraBold];

export const usesTamilFont = (lang: string | null) => lang === "ta";

/** Font files behind the App-* family names that font-patch and the theme use; picked once at launch */
export function appFonts(lang: string | null) {
  const [regular, medium, semibold, bold, extrabold] = usesTamilFont(lang) ? NOTO_SANS_TAMIL : MANROPE;
  return {
    "App-Regular": regular,
    "App-Medium": medium,
    "App-SemiBold": semibold,
    "App-Bold": bold,
    "App-ExtraBold": extrabold,
  };
}
