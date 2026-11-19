'use client';
import { useRef, type RefObject } from 'react';

export default function OtpInput({ value, onChange, disabled, firstInputRef }: {
    value: string; onChange: (value: string) => void; disabled?: boolean;
    firstInputRef: RefObject<HTMLInputElement | null>;
}) {
    const inputs = useRef<(HTMLInputElement | null)[]>([]);
    function focus(index: number) { inputs.current[index]?.focus(); }
    function enter(index: number, raw: string) {
        const digits = raw.replace(/\D/g, '').slice(0, 6);
        if (raw && !digits) return;
        const next = value.padEnd(6, ' ').split('');
        if (!digits) next[index] = ' ';
        else {
            const start = digits.length === 6 ? 0 : index;
            for (let i = 0; i < digits.length && start + i < 6; i++) next[start + i] = digits[i];
            focus(Math.min(start + digits.length, 5));
        }
        onChange(next.join('').trimEnd());
    }
    return <fieldset className="otp-input-group" disabled={disabled}>
        <legend>Verification code</legend>
        <div className="otp-input-slots">{Array.from({ length: 6 }, (_, index) => <input
            key={index} ref={element => { inputs.current[index] = element; if (index === 0) firstInputRef.current = element; }}
            name={'code-digit-' + (index + 1)} aria-label={'Digit ' + (index + 1) + ' of 6'}
            type="text" inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'}
            pattern="[0-9]" maxLength={6} required value={value[index]?.trim() || ''}
            onChange={event => enter(index, event.target.value)}
            onFocus={event => event.target.select()}
            onPaste={event => { event.preventDefault(); enter(index, event.clipboardData.getData('text')); }}
            onKeyDown={event => {
                if (event.key === 'Backspace') {
                    event.preventDefault();
                    const target = value[index]?.trim() ? index : Math.max(index - 1, 0);
                    enter(target, ''); focus(target);
                } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                    event.preventDefault(); focus(Math.max(0, Math.min(5, index + (event.key === 'ArrowLeft' ? -1 : 1))));
                }
            }}
        />)}</div>
    </fieldset>;
}
