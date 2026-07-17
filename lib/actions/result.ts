export type ActionSuccess<T = undefined> = {
  success: true;
  data: T;
  message?: string;
};

export type ActionFailure = {
  success: false;
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
};

export type ActionResult<T = undefined> = ActionSuccess<T> | ActionFailure;

export function ok<T = undefined>(data?: T, message?: string): ActionSuccess<T> {
  return {
    success: true,
    data: data as T,
    message,
  };
}

export function fail(
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>
): ActionFailure {
  return {
    success: false,
    error: { code, message, fieldErrors },
  };
}
