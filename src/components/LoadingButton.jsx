import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';

export default function LoadingButton({ loading = false, children, ...props }) {
  return (
    <button {...props} disabled={loading || props.disabled}>
      {loading && <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" />}
      {children}
    </button>
  );
}
