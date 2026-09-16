sed -i 's/export interface EventSlide {/export interface RightPanelSlide {\n  title: string;\n  subtitle: string;\n  details: string;\n}\n\nexport interface EventSlide {/' backend/src/lib/content.ts
sed -i 's/events: EventSlide\[\];/events: EventSlide\[\];\n  right_slides?: RightPanelSlide\[\];/' backend/src/lib/content.ts
