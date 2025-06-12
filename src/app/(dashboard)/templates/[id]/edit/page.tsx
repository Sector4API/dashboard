"use client"

import { useState, useEffect, useCallback } from "react"
import { Slider } from "@/components/ui/slider"
import { Plus, Minus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

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
  const [isUpdating, setIsUpdating] = useState(false)
  const SCALE_STEP = 0.1 // For fine-tuning buttons

  const handleScaleChange = useCallback((value: number[]) => {
    const newScale = value[0];
    if (newScale === badgeScale || !selectedBadge) return;
    
    setBadgeScale(newScale);
    setBadges(prevBadges => 
      prevBadges.map(badge => {
        if (badge.id === selectedBadge.id) {
          return {
            ...badge,
            scale: newScale
          }
        }
        return badge
      })
    );
  }, [badgeScale, selectedBadge]);

  const handleScaleButtonClick = useCallback((e: React.MouseEvent, increment: boolean) => {
    e.preventDefault(); // Prevent any default browser behavior
    e.stopPropagation(); // Stop event propagation
    
    if (!selectedBadge) return;
    
    setBadgeScale(prev => {
      const newScale = increment ? prev + SCALE_STEP : prev - SCALE_STEP;
      if (newScale <= 0.1 || newScale > 20 || newScale === prev) return prev;
      
      setBadges(prevBadges => 
        prevBadges.map(badge => {
          if (badge.id === selectedBadge.id) {
            return {
              ...badge,
              scale: newScale
            }
          }
          return badge
        })
      );
      
      return newScale;
    });
  }, [selectedBadge, SCALE_STEP]);

  // Update badgeScale when selecting a different badge
  useEffect(() => {
    if (selectedBadge) {
      const newScale = selectedBadge.scale || 1;
      if (newScale !== badgeScale) {
        setBadgeScale(newScale);
      }
    }
  }, [selectedBadge]);

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
                onClick={(e) => handleScaleButtonClick(e, false)}
                disabled={badgeScale <= 0.1 || isUpdating}
                type="button"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="min-w-[60px] text-center">
                {badgeScale.toFixed(1)}x
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={(e) => handleScaleButtonClick(e, true)}
                disabled={badgeScale >= 20 || isUpdating}
                type="button"
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
              max={20}
              step={0.1}
              className="w-[200px]"
              disabled={isUpdating}
            />
          </div>
        </div>
      )}
    </div>
  )
} 