import axios from 'axios'
import URL from 'url'

//判断是否是服务端渲染
const baseURL = process.env.BASE_API;
const instance = axios.create({
    baseURL: baseURL,
    timeout: 5000,
    withCredentials: false,
});

//加入Token在Request拦截器中
instance.interceptors.request.use(config => {
    //console.log(config.baseURL = getSocketHost());
    //并且是服务端渲染的时候
    return config
});

// http response 拦截器,标准的restful请求
instance.interceptors.response.use((res: any): Promise<any> => {
        const ret: any = {data: res.data, status: 200, ok: true, message: res.data.message || 'Request Success'}
        return ret
    },
    (error) => {
        if (error && !error.response) {
            error.response = {data: {message: 'Server Request Fail'}, status: 502}
        }
        const res: any = {
            ok: false,
            message: '访问服务器失败',
            status: 500,
        };
        if (!error.response) {
            res.status = 500;
            res.message = 'API服务器访问失败'
        } else {
            const data = error.response.data;
            res.status = error.response.status;
            res.message = data.message || 'API服务器访问失败';
            res.data = data;
        }
        //401
        if (res.status === 401) {
            // return router.push({name: 'passport-login'});
        }
        return Promise.resolve(res)
    }
);

export const http = instance;

export default instance;

