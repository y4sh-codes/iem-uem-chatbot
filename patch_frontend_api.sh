sed -i 's/export interface EventSlide {/export interface RightPanelSlide {\n  title: string;\n  subtitle: string;\n  details: string;\n}\n\nexport interface EventSlide {/' frontend/src/api.ts
sed -i 's/events: EventSlide\[\];/events: EventSlide\[\];\n  right_slides?: RightPanelSlide\[\];/' frontend/src/api.ts
