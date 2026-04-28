import { useState, forwardRef } from 'react';

/**
 * Password input with a show/hide eye toggle.
 * Drop-in replacement for <input type="password" /> — accepts all the same props.
 *
 * Usage with react-hook-form:
 *   <PasswordInput {...register('password', { required: true })} placeholder="..." />
 */
const PasswordInput = forwardRef(function PasswordInput(
  { className = '', ...rest },
  ref
) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={`${className} pr-10`}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 text-xs"
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {visible ? '🙈' : '👁'}
      </button>
    </div>
  );
});

export default PasswordInput;
