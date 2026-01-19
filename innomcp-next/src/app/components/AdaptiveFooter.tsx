"use client"

import { usePathname } from "next/navigation"
import Footer from "@/app/components/Footer"

export function AdaptiveFooter() {
    const pathname = usePathname()

    // Chat page (/) uses compact footer
    if (pathname === "/") {
        return <Footer variant="compact" align="center" />
    }

    // Other pages use default footer
    return <Footer variant="default" align="center" />
}
