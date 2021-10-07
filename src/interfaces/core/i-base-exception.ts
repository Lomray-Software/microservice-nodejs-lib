interface IBaseException {
  code: number;
  status: number;
  service: string;
  message: string;
  payload: Record<string, any>;
}

export default IBaseException;
