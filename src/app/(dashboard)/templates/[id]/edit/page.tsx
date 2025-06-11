"use client"

import { useState, useEffect } from "react"
import { Slider } from "@/components/ui/slider"
import { Plus, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Badge {
  id: string
  x: number
  y: number
  scale: number
  // ... other existing badge properties ...
}

export default function EditTemplate() {
  const [badges, setBadges] = useState<Badge[]>([])
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null)
  const [badgeScale, setBadgeScale] = useState(1)
  const SCALE_STEP = 0.1 // For fine-tuning buttons

  const handleScaleChange = (value: number[]) => {
    setBadgeScale(value[0])
    // Update badge scale in your existing logic
    const updatedBadges = badges.map(badge => {
      if (badge.id === selectedBadge?.id) {
        return {
          ...badge,
          scale: value[0]
        }
      }
      return badge
    })
    setBadges(updatedBadges)
  }

  const handleScaleButtonClick = (increment: boolean) => {
    const newScale = increment ? badgeScale + SCALE_STEP : badgeScale - SCALE_STEP
    if (newScale > 0) { // Prevent negative scaling
      setBadgeScale(newScale)
      const updatedBadges = badges.map(badge => {
        if (badge.id === selectedBadge?.id) {
          return {
            ...badge,
            scale: newScale
          }
        }
        return badge
      })
      setBadges(updatedBadges)
    }
  }

  // Update badgeScale when selecting a different badge
  useEffect(() => {
    if (selectedBadge) {
      setBadgeScale(selectedBadge.scale || 1)
    }
  }, [selectedBadge])

  return (
    <div>
      {selectedBadge && (
        <div className="space-y-4 mt-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">Badge Scale</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleScaleButtonClick(false)}
                disabled={badgeScale <= 0.1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="min-w-[60px] text-center">
                {badgeScale.toFixed(1)}x
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleScaleButtonClick(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Slider
              value={[badgeScale]}
              onValueChange={handleScaleChange}
              min={0.1}
              max={10}
              step={0.1}
              className="w-[200px]"
            />
          </div>
        </div>
      )}
    </div>
  )
} 