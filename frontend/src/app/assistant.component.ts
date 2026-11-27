import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LangService } from './lang.service';
import { TriageChatComponent } from './triage-chat.component';

/** Page de l'assistant santé (chat). */
@Component({
  selector: 'app-assistant',
  standalone: true,
  imports: [TriageChatComponent],
  template: `
    <section class="page-section orientation-page">
      <div class="orientation-shell chatbot-shell">
        <div class="orientation-top">
          <div>
            <span class="section-kicker">{{ t('ASSISTANT SANTÉ', 'المساعد الصحي') }}</span>
            <h1>{{ t('Parlons de ce que vous ressentez.', 'لنتحدث عما تشعر به.') }}</h1>
          </div>
          <span class="chat-online"><i></i>{{ t('Assistant disponible', 'المساعد متاح') }}</span>
        </div>
        <p class="chat-intro">{{ t('Décrivez vos symptômes en français, en arabe ou en derja. Je vous pose quelques questions, puis je vous oriente.', 'صف أعراضك بالفرنسية أو العربية أو الدارجة. سأطرح عليك بعض الأسئلة ثم أوجهك.') }}
          <button class="as-link" (click)="router.navigateByUrl('/orientation')">{{ t('Préférez-vous un questionnaire guidé ?', 'هل تفضل استبياناً موجهاً؟') }} →</button></p>
        <app-triage-chat [lang]="langService.lang()" />
      </div>
    </section>
  `,
  styles: [`
    .as-link { border: 0; background: none; color: var(--text2); font-weight: 700; padding: 0; margin-inline-start: 6px; }
  `],
})
export class AssistantComponent {
  readonly router = inject(Router);
  readonly langService = inject(LangService);
  t(fr: string, ar: string) { return this.langService.lang() === 'fr' ? fr : ar; }
}
