import { useEffect, useState } from "react";
import { getTheme } from "../theme";

// Logo d'AWS: amb lletres fosques al tema clar i en crema al tema fosc, sempre amb el fons transparent.
export function AwsLogo({ className, height, alt = "" }: { className?: string; height: number; alt?: string }) {
  const [theme, setTheme] = useState(getTheme);
  useEffect(() => {
    const sync = () => setTheme(getTheme());
    window.addEventListener("site-theme", sync);
    return () => window.removeEventListener("site-theme", sync);
  }, []);
  return <img src={theme === "dark" ? "/aws-logo-dark.svg" : "/aws-logo.svg"} alt={alt} className={className} height={height} />;
}
