import { Redirect } from 'expo-router';
/** More tab removed: profile is the header avatar; its links live on the profile screen. */
export default function More() { return <Redirect href="/profile" />; }
